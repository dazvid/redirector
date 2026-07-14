import { shortcutService } from "@/features/shortcuts";
import { ok, toErrorResponse } from "@/lib/api-response";
import { getViewer, requireSession } from "@/lib/auth";

/**
 * GET /api/shortcuts — list shortcuts (public, but viewer-aware). Signed-in
 * viewers see public shortcuts plus their own personal ones; admins see
 * everything; anonymous requests get public shortcuts only.
 */
export async function GET() {
  try {
    const viewer = await getViewer();
    const shortcuts = await shortcutService.listShortcuts(viewer);
    return ok(shortcuts);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/shortcuts — create a shortcut owned by the caller (authenticated). */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const shortcut = await shortcutService.createShortcut(body, session.user);
    return ok(shortcut, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
