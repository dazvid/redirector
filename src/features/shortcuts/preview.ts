import { fetchPageHead } from "@/lib/ssrf-safe-fetch";
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
    // Reject data: URIs — some sites use `href="data:,"` (an empty data
    // URI) as an explicit "no favicon" signal. It's not a network image,
    // so <img> may never fire load or error on it, wedging the client's
    // onError fallback chain. Treat it the same as "nothing found" so
    // extraction moves on to the next candidate (or the caller's own
    // favicon.ico guess) instead of storing something unusable.
    if (resolved.protocol === "data:") return null;
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
      imageUrl = extractPreviewImageUrl(html, shortcut.url);
    } catch {
      imageUrl = null;
    }
    await repository.setPreviewImage(shortcut.id, imageUrl).catch(() => {});
  };
}
