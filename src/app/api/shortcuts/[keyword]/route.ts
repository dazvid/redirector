import { shortcutService } from "@/features/shortcuts";
import { ok, toErrorResponse } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";

type RouteContext = { params: Promise<{ keyword: string }> };

/** GET /api/shortcuts/{keyword} — fetch one shortcut (public). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { keyword } = await context.params;
    const shortcut = await shortcutService.getShortcut(keyword);
    return ok(shortcut);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * PUT /api/shortcuts/{keyword} — update keyword/URL/category.
 * Requires auth; the service enforces owner-or-admin (403 otherwise).
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { keyword } = await context.params;
    const body = await request.json();
    const shortcut = await shortcutService.updateShortcut(keyword, body, session.user);
    return ok(shortcut);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * DELETE /api/shortcuts/{keyword} — remove a shortcut. Requires auth; the
 * service enforces owner-or-admin (403 otherwise).
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { keyword } = await context.params;
    await shortcutService.deleteShortcut(keyword, session.user);
    return ok({ deleted: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
