import { afterEach, describe, expect, it } from "vitest";
import { clientIp, rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rateLimit", () => {
  afterEach(() => resetRateLimits());

  it("allows attempts up to the limit, then blocks", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 1000, t0).allowed).toBe(true);
    }
    const blocked = rateLimit("k", 3, 1000, t0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const t0 = 1_000_000;
    expect(rateLimit("k", 1, 1000, t0).allowed).toBe(true);
    expect(rateLimit("k", 1, 1000, t0).allowed).toBe(false);
    // Past the window — a fresh bucket.
    expect(rateLimit("k", 1, 1000, t0 + 1001).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const t0 = 1_000_000;
    expect(rateLimit("a", 1, 1000, t0).allowed).toBe(true);
    expect(rateLimit("a", 1, 1000, t0).allowed).toBe(false);
    // A different key is unaffected.
    expect(rateLimit("b", 1, 1000, t0).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the first hop of X-Forwarded-For", () => {
    const request = new Request("https://go.example/x", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIp(request)).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP", () => {
    const request = new Request("https://go.example/x", {
      headers: { "x-real-ip": "198.51.100.9" },
    });
    expect(clientIp(request)).toBe("198.51.100.9");
  });

  it("degrades to a constant when no IP header is present", () => {
    const request = new Request("https://go.example/x");
    expect(clientIp(request)).toBe("unknown");
  });
});
