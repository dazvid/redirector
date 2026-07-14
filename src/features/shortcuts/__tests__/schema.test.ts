import { describe, expect, it } from "vitest";
import {
  RESERVED_KEYWORDS,
  createShortcutSchema,
  keywordSchema,
  urlSchema,
} from "@/features/shortcuts/schema";

describe("keywordSchema", () => {
  it("accepts simple lowercase keywords", () => {
    expect(keywordSchema.parse("youtube")).toBe("youtube");
    expect(keywordSchema.parse("my-team-2")).toBe("my-team-2");
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(keywordSchema.parse("  YouTube ")).toBe("youtube");
  });

  it("rejects invalid characters", () => {
    for (const bad of ["has space", "slash/es", "under_score", "émoji", ""]) {
      expect(keywordSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects leading or trailing hyphens", () => {
    expect(keywordSchema.safeParse("-lead").success).toBe(false);
    expect(keywordSchema.safeParse("trail-").success).toBe(false);
  });

  it("rejects keywords longer than 64 characters", () => {
    expect(keywordSchema.safeParse("a".repeat(65)).success).toBe(false);
    expect(keywordSchema.safeParse("a".repeat(64)).success).toBe(true);
  });

  it("rejects every reserved keyword, so shortcuts cannot shadow app routes", () => {
    for (const reserved of RESERVED_KEYWORDS) {
      expect(keywordSchema.safeParse(reserved).success).toBe(false);
    }
  });
});

describe("urlSchema", () => {
  it("accepts http and https URLs", () => {
    expect(urlSchema.parse("https://www.youtube.com")).toBe(
      "https://www.youtube.com"
    );
    expect(urlSchema.parse("http://internal.example:8080/path?q=1")).toBe(
      "http://internal.example:8080/path?q=1"
    );
  });

  it("rejects non-http(s) protocols (prevents javascript: injection)", () => {
    for (const bad of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "ftp://example.com",
      "data:text/html,hi",
    ]) {
      expect(urlSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects strings that are not URLs", () => {
    expect(urlSchema.safeParse("not a url").success).toBe(false);
    expect(urlSchema.safeParse("www.youtube.com").success).toBe(false);
  });
});

describe("createShortcutSchema", () => {
  it("requires both keyword and url", () => {
    expect(
      createShortcutSchema.safeParse({ keyword: "youtube" }).success
    ).toBe(false);
    expect(
      createShortcutSchema.safeParse({ url: "https://example.com" }).success
    ).toBe(false);
  });
});
