import dns from "node:dns/promises";
import net from "node:net";

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 200_000; // the <head> we care about is always near the top
const MAX_REDIRECTS = 5;
const USER_AGENT = "go-links-preview/1.0 (+link preview fetcher)";

/**
 * True for addresses that are loopback, link-local (including the cloud
 * metadata endpoint at 169.254.169.254), RFC1918 private ranges, CGNAT,
 * or multicast/reserved space. Used to stop the preview fetcher — the one
 * place this app makes a server-side request to a user-supplied URL —
 * from being usable for SSRF against internal services.
 *
 * Note: this checks the IP resolved *before* connecting, not the socket
 * actually connected to, so a DNS answer that changes between the check
 * and the fetch (DNS rebinding) is a known, accepted residual risk here —
 * full protection would mean pinning the connection to the checked IP,
 * which is more machinery than this cosmetic feature warrants.
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
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
  if (lower.startsWith("::ffff:")) {
    const embedded = lower.slice("::ffff:".length);
    if (net.isIPv4(embedded)) return isPrivateIp(embedded);
  }
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0) {
    throw new Error(`Could not resolve ${hostname}`);
  }
  for (const { address } of records) {
    if (isPrivateIp(address)) {
      throw new Error(`Refusing to fetch private/internal address ${address}`);
    }
  }
}

/**
 * Fetches up to MAX_BYTES of the response body for `targetUrl`, following
 * redirects manually (re-validating each hop) so a public URL can't be
 * used to smuggle a request to an internal address via a redirect chain.
 */
export async function fetchPageHead(targetUrl: string): Promise<string> {
  let current = targetUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(current);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Unsupported protocol ${parsed.protocol}`);
    }
    await assertPublicHost(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      });
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect response had no Location header");
      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status} fetching ${current}`);
    }

    return readCapped(response, MAX_BYTES);
  }

  throw new Error("Too many redirects");
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf-8");
}
