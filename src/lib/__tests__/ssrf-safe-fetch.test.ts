import { afterEach, describe, expect, it, vi } from "vitest";
import dns from "node:dns";
import { isPrivateIp, safeLookup } from "@/lib/ssrf-safe-fetch";

describe("isPrivateIp", () => {
  it("flags loopback addresses", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.5.5.5")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("flags the cloud metadata / link-local range", () => {
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
  });

  it("flags RFC1918 private ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
  });

  it("does not flag adjacent-but-public 172.x ranges", () => {
    expect(isPrivateIp("172.15.255.255")).toBe(false);
    expect(isPrivateIp("172.32.0.0")).toBe(false);
  });

  it("flags CGNAT (100.64.0.0/10)", () => {
    expect(isPrivateIp("100.64.0.1")).toBe(true);
    expect(isPrivateIp("100.100.0.1")).toBe(true);
    expect(isPrivateIp("100.128.0.1")).toBe(false);
  });

  it("flags multicast and reserved space", () => {
    expect(isPrivateIp("224.0.0.1")).toBe(true);
    expect(isPrivateIp("255.255.255.255")).toBe(true);
  });

  it("flags IPv6 unique local addresses", () => {
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456::1")).toBe(true);
  });

  it("unwraps IPv4-mapped IPv6 addresses before checking", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
  });

  it("does not flag ordinary public addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("93.184.216.34")).toBe(false);
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });

  it("flags the unspecified IPv6 address", () => {
    expect(isPrivateIp("::")).toBe(true);
  });
});

/**
 * safeLookup is what the socket layer actually uses to resolve, so the
 * address it returns is the address the connection will use. These tests
 * pin down that it refuses private results (closing the DNS-rebinding gap)
 * while passing public ones through — under both the single-address and
 * `{ all: true }` (Happy Eyeballs) resolver contracts.
 */
describe("safeLookup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  type LookupResult =
    | { address: string; family: number }
    | { all: dns.LookupAddress[] };

  function mockDns(result: LookupResult | Error) {
    vi.spyOn(dns, "lookup").mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((_hostname: string, _options: unknown, cb: any) => {
        if (result instanceof Error) return cb(result);
        if ("all" in result) return cb(null, result.all);
        return cb(null, result.address, result.family);
      }) as unknown as typeof dns.lookup
    );
  }

  function run(
    options: dns.LookupOneOptions | dns.LookupAllOptions
  ): Promise<{ err: Error | null; address: unknown }> {
    return new Promise((resolve) => {
      safeLookup("example.test", options, (err, address) =>
        resolve({ err, address })
      );
    });
  }

  it("rejects a hostname that resolves to a private IP", async () => {
    mockDns({ address: "127.0.0.1", family: 4 });
    const { err } = await run({ family: 4 });
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toContain("127.0.0.1");
  });

  it("rejects a hostname that resolves to the cloud metadata IP", async () => {
    mockDns({ address: "169.254.169.254", family: 4 });
    const { err } = await run({ family: 4 });
    expect(err).toBeInstanceOf(Error);
  });

  it("passes a public single-address result through unchanged", async () => {
    mockDns({ address: "93.184.216.34", family: 4 });
    const { err, address } = await run({ family: 4 });
    expect(err).toBeNull();
    expect(address).toBe("93.184.216.34");
  });

  it("filters private entries out of an { all: true } result", async () => {
    mockDns({
      all: [
        { address: "10.0.0.5", family: 4 },
        { address: "93.184.216.34", family: 4 },
      ],
    });
    const { err, address } = await run({ all: true });
    expect(err).toBeNull();
    expect(address).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("rejects an { all: true } result with no public addresses", async () => {
    mockDns({ all: [{ address: "10.0.0.5", family: 4 }] });
    const { err } = await run({ all: true });
    expect(err).toBeInstanceOf(Error);
  });

  it("propagates a resolver error", async () => {
    mockDns(new Error("ENOTFOUND"));
    const { err } = await run({ family: 4 });
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toContain("ENOTFOUND");
  });
});
