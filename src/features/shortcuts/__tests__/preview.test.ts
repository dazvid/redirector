import { describe, expect, it } from "vitest";
import { extractPreviewImageUrl } from "@/features/shortcuts/preview";

describe("extractPreviewImageUrl", () => {
  it("finds an og:image with content after property", () => {
    const html = `<html><head><meta property="og:image" content="https://example.com/card.png"></head></html>`;
    expect(extractPreviewImageUrl(html, "https://example.com")).toBe(
      "https://example.com/card.png"
    );
  });

  it("finds an og:image with content before property", () => {
    const html = `<meta content="https://example.com/card.png" property="og:image">`;
    expect(extractPreviewImageUrl(html, "https://example.com")).toBe(
      "https://example.com/card.png"
    );
  });

  it("resolves a relative og:image against the page URL", () => {
    const html = `<meta property="og:image" content="/images/card.png">`;
    expect(extractPreviewImageUrl(html, "https://example.com/some/page")).toBe(
      "https://example.com/images/card.png"
    );
  });

  it("falls back to twitter:image when there's no og:image", () => {
    const html = `<meta name="twitter:image" content="https://example.com/tw.png">`;
    expect(extractPreviewImageUrl(html, "https://example.com")).toBe(
      "https://example.com/tw.png"
    );
  });

  it("falls back to a declared favicon link when there's no meta image", () => {
    const html = `<link rel="icon" href="/favicon.png">`;
    expect(extractPreviewImageUrl(html, "https://example.com")).toBe(
      "https://example.com/favicon.png"
    );
  });

  it("prefers og:image over twitter:image over favicon", () => {
    const html = `
      <link rel="icon" href="/favicon.png">
      <meta name="twitter:image" content="https://example.com/tw.png">
      <meta property="og:image" content="https://example.com/og.png">
    `;
    expect(extractPreviewImageUrl(html, "https://example.com")).toBe(
      "https://example.com/og.png"
    );
  });

  it("returns null when nothing usable is found", () => {
    const html = `<html><head><title>No previews here</title></head></html>`;
    expect(extractPreviewImageUrl(html, "https://example.com")).toBeNull();
  });

  it("returns null rather than throwing on a malformed image URL", () => {
    const html = `<meta property="og:image" content="not a url and no base to fix it">`;
    expect(extractPreviewImageUrl(html, "not-a-valid-base either")).toBeNull();
  });

  it("rejects a data: URI favicon (the common 'explicitly no icon' placeholder)", () => {
    // <img src="data:,"> may never fire load or error, wedging the
    // client's fallback chain — so this must be treated as "not found".
    const html = `<link rel="icon" href="data:,">`;
    expect(extractPreviewImageUrl(html, "https://example.com")).toBeNull();
  });

  it("still finds a real favicon after skipping an og:image that's a data: URI", () => {
    const html = `
      <meta property="og:image" content="data:,">
      <link rel="icon" href="/favicon.png">
    `;
    expect(extractPreviewImageUrl(html, "https://example.com")).toBe(
      "https://example.com/favicon.png"
    );
  });

  it("rejects a javascript: image URL", () => {
    const html = `<meta property="og:image" content="javascript:alert(1)">`;
    expect(extractPreviewImageUrl(html, "https://example.com")).toBeNull();
  });

  it("skips a non-http(s) og:image and falls back to a real favicon", () => {
    const html = `
      <meta property="og:image" content="javascript:alert(1)">
      <link rel="icon" href="/favicon.png">
    `;
    expect(extractPreviewImageUrl(html, "https://example.com")).toBe(
      "https://example.com/favicon.png"
    );
  });
});
