import { headers } from "next/headers";
import { CopyableUrl } from "./CopyableUrl";

/**
 * Static instructions for configuring go/links as a browser keyword search
 * engine, so typing "go youtube" in the address bar jumps straight to a
 * shortcut from anywhere. The origin is derived from the request (not
 * hardcoded) so this page is correct for whoever deploys their own copy
 * of the app, not just this instance.
 */
export default async function SetupPage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;
  const searchUrl = `${origin}/%s`;

  return (
    <>
      <div className="page-head">
        <span className="brandmark">go</span>
        <div>
          <h1>Set up go/ as a browser keyword</h1>
          <p className="lede">
            Once configured, type <span className="kw">go youtube</span> in
            your address bar from anywhere to jump straight to that shortcut
            — no need to visit this site first.
          </p>
        </div>
      </div>

      <div className="card elev-sm" style={{ marginBottom: 28 }}>
        <div className="field">
          <label>Your search URL</label>
          <CopyableUrl url={searchUrl} />
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Use this URL and the keyword <span className="kw">go</span> in the
          steps for your browser below. The <span className="kw">%s</span>{" "}
          is replaced with whatever you type after the keyword.
        </p>
      </div>

      <h4>Firefox</h4>
      <ol>
        <li>Open Firefox Settings (☰ menu → Settings), then go to the Search panel.</li>
        <li>Scroll down to Search Shortcuts and click Add.</li>
        <li>
          Fill in: Name <span className="kw">go/links</span>, Keyword{" "}
          <span className="kw">go</span>, URL — paste the search URL above.
        </li>
        <li>Click Add Engine.</li>
        <li>
          In the address bar, type <span className="kw">go youtube</span> and
          press Enter.
        </li>
      </ol>

      <h4>Chrome (also Edge, Brave, and other Chromium browsers)</h4>
      <ol>
        <li>
          Go to <span className="kw">chrome://settings/searchEngines</span>{" "}
          (or Settings → Search engine → Manage search engines and site
          search).
        </li>
        <li>Next to &ldquo;Site search,&rdquo; click Add.</li>
        <li>
          Fill in: Search engine <span className="kw">go/links</span>,
          Shortcut <span className="kw">go</span>, URL with %s in place of
          query — paste the search URL above.
        </li>
        <li>Click Add.</li>
        <li>
          In the address bar, type <span className="kw">go youtube</span> and
          press Enter (or type <span className="kw">go</span>, press Tab,
          then type the keyword).
        </li>
      </ol>

      <h4>Safari</h4>
      <p className="lede" style={{ marginBottom: 8 }}>
        Safari doesn&rsquo;t support custom keyword search engines natively —
        it only offers a fixed list (Google, Yahoo, Bing, DuckDuckGo,
        Ecosia). There are two ways around that:
      </p>
      <ol>
        <li>
          <strong>No setup:</strong> just type the address directly —{" "}
          <span className="kw">{host}/youtube</span> in the address bar and
          press Return. This always works, no configuration needed.
        </li>
        <li>
          <strong>For a &ldquo;go youtube&rdquo; shortcut:</strong> install a
          third-party Safari extension that adds custom keyword search
          (search the Mac App Store for &ldquo;custom search engine&rdquo;),
          then point it at the search URL above the same way as Chrome/Firefox.
        </li>
      </ol>

      <p className="muted">
        Keywords are single words (letters, numbers, hyphens) — a query with
        spaces won&rsquo;t match a shortcut.
      </p>
    </>
  );
}
