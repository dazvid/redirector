import { requireSession } from "@/lib/auth";
import { ShortcutManager } from "@/features/shortcuts/components/ShortcutManager";

/**
 * Admin console (the "Console" direction). Middleware already redirects
 * unauthenticated visitors to /login; requireSession() here is the
 * defense-in-depth check.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ keyword?: string }>;
}) {
  const session = await requireSession();
  const { keyword } = await searchParams;

  return (
    <>
      <h1>Manage shortcuts</h1>
      <p className="lede">
        Signed in as <span className="kw">{session.user.username}</span>
        {session.user.isAdmin ? " (admin)" : ""}. Changes take effect
        immediately across <span className="kw">go/</span>.
      </p>
      <ShortcutManager initialKeyword={keyword ?? ""} />
    </>
  );
}
