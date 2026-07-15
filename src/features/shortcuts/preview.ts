import { fetchPageHead, urlResolvesToPublicHost } from "@/lib/ssrf-safe-fetch";
import type { Shortcut, ShortcutRepository } from "@/features/shortcuts/repository";

const META_PATTERNS: RegExp[] = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
];

const ICON_PATTERNS: RegExp[] = [
  /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i,
  /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon)["']/i,
];

function resolveAgainst(candidate: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(candidate, baseUrl);
    // Only http(s) images are storable. This drops data: URIs (some sites
    // use `href="data:,"` as a "no favicon" signal, which wedges the
    // client's <img> onError fallback chain) but also, and more
    // importantly, javascript:/blob:/file: and any other scheme an
    // attacker-controlled page might advertise via og:image — the value is
    // later emitted straight into an <img src> in the public directory.
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Pulls a preview image out of a page's HTML: og:image, then
 * twitter:image, then a declared favicon link. Pure and dependency-free
 * on purpose, so it's cheap to unit test against HTML fixtures.
 */
export function extractPreviewImageUrl(html: string, baseUrl: string): string | null {
  for (const pattern of META_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const resolved = resolveAgainst(match[1], baseUrl);
      if (resolved) return resolved;
    }
  }
  for (const pattern of ICON_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const resolved = resolveAgainst(match[1], baseUrl);
      if (resolved) return resolved;
    }
  }
  return null;
}

/**
 * Wires the SSRF-safe fetch + extraction into a fire-and-forget refresher
 * the service calls after create/URL-changing update. Never throws —
 * failures just leave previewImageUrl null so the UI falls back to a
 * guessed favicon (see DirectoryBrowser).
 */
export function createPreviewRefresher(repository: ShortcutRepository) {
  return async function refreshPreview(shortcut: Pick<Shortcut, "id" | "url">): Promise<void> {
    let imageUrl: string | null = null;
    try {
      const html = await fetchPageHead(shortcut.url);
      const candidate = extractPreviewImageUrl(html, shortcut.url);
      // Don't persist an image URL that points at an internal host — it
      // would be rendered in every directory visitor's <img>, turning their
      // browser into a probe against the private network.
      if (candidate && (await urlResolvesToPublicHost(candidate))) {
        imageUrl = candidate;
      }
    } catch {
      imageUrl = null;
    }
    await repository.setPreviewImage(shortcut.id, imageUrl).catch(() => {});
  };
}
