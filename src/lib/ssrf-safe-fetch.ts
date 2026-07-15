import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 200_000; // the <head> we care about is always near the top
const MAX_REDIRECTS = 5;
const USER_AGENT = "go-links-preview/1.0 (+link preview fetcher)";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * True for addresses that are loopback, link-local (including the cloud
 * metadata endpoint at 169.254.169.254), RFC1918 private ranges, CGNAT,
 * or multicast/reserved space. Used to stop the preview fetcher — the one
 * place this app makes a server-side request to a user-supplied URL —
 * from being usable for SSRF against internal services.
 */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower === "::") return true; // unspecified — routes to loopback
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
  if (lower.startsWith("::ffff:")) {
    const embedded = lower.slice("::ffff:".length);
    if (net.isIPv4(embedded)) return isPrivateIp(embedded);
  }
  return false;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number
) => void;

/**
 * A drop-in replacement for the socket layer's DNS resolver that (a)
 * resolves the hostname and (b) refuses any private/internal address —
 * and critically, the socket then connects to *exactly* the address this
 * function returns. That eliminates the DNS-rebinding time-of-check /
 * time-of-use gap: there is no second, unchecked resolution between our
 * validation and the connection, because this validated result *is* what
 * the connection uses. Handles both the single-address contract and the
 * `{ all: true }` array contract (Happy Eyeballs / autoSelectFamily).
 */
export function safeLookup(
  hostname: string,
  options: dns.LookupOneOptions | dns.LookupAllOptions,
  callback: LookupCallback
): void {
  const handle: LookupCallback = (err, address, family) => {
    if (err) {
      callback(err, address, family);
      return;
    }

    if (Array.isArray(address)) {
      const safe = address.filter((entry) => !isPrivateIp(entry.address));
      if (safe.length === 0) {
        callback(
          new Error(`Refusing to connect to private/internal address for ${hostname}`),
          [],
          undefined
        );
        return;
      }
      callback(null, safe);
      return;
    }

    if (isPrivateIp(address)) {
      callback(
        new Error(`Refusing to connect to private/internal address ${address}`),
        address,
        family
      );
      return;
    }
    callback(null, address, family);
  };

  // dns.lookup's overloads don't cover a callback whose `address` is a
  // union of the single-address and all-addresses shapes, so bridge to it
  // through the raw signature.
  (
    dns.lookup as unknown as (
      hostname: string,
      options: dns.LookupOneOptions | dns.LookupAllOptions,
      callback: LookupCallback
    ) => void
  )(hostname, options, handle);
}

/**
 * Best-effort check that every address `url`'s host resolves to is public.
 * Used to decide whether a *derived* image URL (an og:image / favicon we
 * extracted from a fetched page) is safe to store and later render in a
 * browser <img>, so a page can't point every directory visitor's browser
 * at an internal host. Returns false on any resolution failure.
 */
export async function urlResolvesToPublicHost(url: string): Promise<boolean> {
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") return false;
    const records = await dns.promises.lookup(hostname, { all: true });
    return records.length > 0 && records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}

interface RawResponse {
  status: number;
  location: string | undefined;
  body: string;
}

/**
 * A single request with no automatic redirect following. Connects only to
 * the IP `safeLookup` validated, caps the body at MAX_BYTES, and enforces
 * an overall timeout.
 */
function requestOnce(url: URL): Promise<RawResponse> {
  const transport = url.protocol === "https:" ? https : http;

  return new Promise<RawResponse>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimer);
      fn();
    };

    const req = transport.request(
      url,
      {
        method: "GET",
        // The security-critical bit: the socket resolves via safeLookup,
        // so it can never connect to an address we didn't just validate.
        lookup: safeLookup,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" },
      },
      (res) => {
        const status = res.statusCode ?? 0;

        if (REDIRECT_STATUSES.has(status)) {
          const location = res.headers.location;
          res.destroy();
          done(() => resolve({ status, location, body: "" }));
          return;
        }

        const chunks: Buffer[] = [];
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          received += chunk.length;
          if (received >= MAX_BYTES) res.destroy();
        });
        const finish = () =>
          done(() =>
            resolve({
              status,
              location: undefined,
              body: Buffer.concat(chunks).toString("utf-8"),
            })
          );
        res.on("end", finish);
        // `close` fires (without `end`) when we destroy the stream after
        // hitting the byte cap — still a successful read of what we need.
        res.on("close", finish);
        res.on("error", (error) => done(() => reject(error)));
      }
    );

    const overallTimer = setTimeout(() => {
      req.destroy(new Error(`Timed out fetching ${url.toString()}`));
    }, FETCH_TIMEOUT_MS);

    req.on("error", (error) => done(() => reject(error)));
    req.end();
  });
}

/**
 * Fetches up to MAX_BYTES of the response body for `targetUrl`, following
 * redirects manually. Every hop — the initial URL and each redirect target
 * — connects through `safeLookup`, so a redirect to an internal address is
 * rejected at connect time just like the initial URL.
 */
export async function fetchPageHead(targetUrl: string): Promise<string> {
  let current = targetUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(current);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Unsupported protocol ${parsed.protocol}`);
    }

    const { status, location, body } = await requestOnce(parsed);

    if (REDIRECT_STATUSES.has(status)) {
      if (!location) throw new Error("Redirect response had no Location header");
      current = new URL(location, current).toString();
      continue;
    }

    if (status < 200 || status >= 300) {
      throw new Error(`Unexpected status ${status} fetching ${current}`);
    }

    return body;
  }

  throw new Error("Too many redirects");
}
