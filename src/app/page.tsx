import Link from "next/link";
import { shortcutService } from "@/features/shortcuts";
import { DirectoryBrowser } from "@/features/shortcuts/components/DirectoryBrowser";
import { getViewer } from "@/lib/auth";

/**
 * Public directory of shortcuts (the "Directory" direction). Also serves
 * as the landing spot for unknown keywords (?missing=...), offering to
 * create them. Data is fetched here (server) and handed to the client
 * DirectoryBrowser for instant search / filtering. Signed-in viewers see
 * public shortcuts plus their own personal ones; admins see everything.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ missing?: string }>;
}) {
  const { missing } = await searchParams;
  const viewer = await getViewer();
  const shortcuts = await shortcutService.listShortcuts(viewer);

  return (
    <>
      <div className="page-head">
        <span className="brandmark">go</span>
        <div>
          <h1>Team directory</h1>
          <p className="lede">Every internal link, one keyword away.</p>
        </div>
      </div>

      {missing ? (
        <p className="notice">
          No shortcut exists for <span className="kw">go/{missing}</span> yet.{" "}
          <Link href={`/admin?keyword=${encodeURIComponent(missing)}`}>
            Create it
          </Link>
          .
        </p>
      ) : null}

      {shortcuts.length === 0 ? (
        <p className="empty">
          No shortcuts yet. <Link href="/admin">Add the first one</Link>.
        </p>
      ) : (
        <DirectoryBrowser
          shortcuts={shortcuts.map((s) => ({
            id: s.id,
            keyword: s.keyword,
            url: s.url,
            category: s.category,
            clickCount: s.clickCount,
            visibility: s.visibility,
            ownerUsername: s.ownerUsername,
            isMine: s.isMine,
          }))}
        />
      )}
    </>
  );
}
