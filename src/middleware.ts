import { auth } from "@/lib/auth";

/**
 * Coarse-grained gate: unauthenticated users are redirected away from
 * /admin, and mutating API calls get a 401. Route handlers repeat the
 * check via requireSession() as defense in depth.
 */
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth?.user);

  if (pathname.startsWith("/admin") && !isAuthenticated) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  const isShortcutMutation =
    pathname.startsWith("/api/shortcuts") && request.method !== "GET";

  if (isShortcutMutation && !isAuthenticated) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }
});

export const config = {
  matcher: ["/admin/:path*", "/api/shortcuts/:path*"],
};
