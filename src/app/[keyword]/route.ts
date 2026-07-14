import { NextResponse } from "next/server";
import { shortcutService } from "@/features/shortcuts";

type RouteContext = { params: Promise<{ keyword: string }> };

/**
 * GET /{keyword} — the core redirect. 302 (temporary) so browsers keep
 * asking the server and edits to a shortcut take effect immediately.
 * resolveKeyword also records a hit (clickCount++). Unknown keywords
 * land back on the home page, which offers to create the shortcut.
 */
export async function GET(request: Request, context: RouteContext) {
  const { keyword } = await context.params;
  const shortcut = await shortcutService.resolveKeyword(keyword);

  if (!shortcut) {
    const homeUrl = new URL("/", request.url);
    homeUrl.searchParams.set("missing", keyword);
    return NextResponse.redirect(homeUrl, 302);
  }

  return NextResponse.redirect(shortcut.url, 302);
}
