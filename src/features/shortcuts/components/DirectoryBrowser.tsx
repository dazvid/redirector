"use client";

import { useMemo, useState } from "react";
import { CopyIcon, OpenIcon, SearchIcon } from "@/components/Icons";

interface DirectoryShortcut {
  id: string;
  keyword: string;
  url: string;
  category: string | null;
  clickCount: number;
  visibility: "PUBLIC" | "PERSONAL";
  ownerUsername: string;
  isMine: boolean;
}

const UNCATEGORIZED = "Other";

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function formatCount(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  }
  return String(n);
}

/**
 * Public, browse-first directory (the "Directory" direction). Server
 * component passes the full list in; filtering and grouping happen
 * client-side for instant search with no round-trips.
 */
export function DirectoryBrowser({
  shortcuts,
}: {
  shortcuts: DirectoryShortcut[];
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [toast, setToast] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of shortcuts) set.add(s.category ?? UNCATEGORIZED);
    return ["All", ...Array.from(set).sort()];
  }, [shortcuts]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = shortcuts.filter((s) => {
      const cat = s.category ?? UNCATEGORIZED;
      const matchesQuery =
        !q ||
        s.keyword.includes(q) ||
        s.url.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q);
      const matchesCat = activeCategory === "All" || cat === activeCategory;
      return matchesQuery && matchesCat;
    });

    const byCat = new Map<string, DirectoryShortcut[]>();
    for (const s of filtered) {
      const cat = s.category ?? UNCATEGORIZED;
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(s);
    }
    return Array.from(byCat.entries())
      .map(([cat, items]) => ({
        cat,
        items: items.sort((a, b) => b.clickCount - a.clickCount),
      }))
      .sort((a, b) => a.cat.localeCompare(b.cat));
  }, [shortcuts, query, activeCategory]);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout((showToast as unknown as { t?: number }).t);
    (showToast as unknown as { t?: number }).t = window.setTimeout(
      () => setToast(null),
      1900
    );
  }

  async function copy(keyword: string) {
    try {
      await navigator.clipboard?.writeText(`go/${keyword}`);
    } catch {
      /* clipboard unavailable — toast still confirms intent */
    }
    showToast(`Copied go/${keyword} to clipboard`);
  }

  const isEmpty = groups.length === 0;

  return (
    <>
      <div className="dir-toolbar">
        <div className="search">
          <SearchIcon />
          <input
            className="plain"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search shortcuts"
          />
        </div>
      </div>

      <div className="chip-row">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`chip${cat === activeCategory ? " on" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {isEmpty ? (
        <p className="empty">Nothing matches “{query}”.</p>
      ) : (
        <div className="dir-groups">
          {groups.map((g) => (
            <section key={g.cat}>
              <div className="cat-head">
                <span className="cat-label">{g.cat}</span>
                <span className="cat-rule" />
                <span className="cat-count">
                  {g.items.length} {g.items.length === 1 ? "link" : "links"}
                </span>
              </div>
              <div className="dir-grid">
                {g.items.map((s) => (
                  <article key={s.id} className="card elev-sm link-card">
                    <div className="link-card-top">
                      <span className="kw">go/{s.keyword}</span>
                      <span className="opens">{formatCount(s.clickCount)} opens</span>
                    </div>
                    <div className="dest mono trunc">{hostOf(s.url)}</div>
                    {s.visibility === "PERSONAL" || !s.isMine ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {s.visibility === "PERSONAL" ? (
                          <span className="tag tag-neutral">Personal</span>
                        ) : null}
                        {!s.isMine ? (
                          <span className="opens">by {s.ownerUsername}</span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="card-actions">
                      <button
                        type="button"
                        className="iconbtn"
                        title="Copy"
                        onClick={() => copy(s.keyword)}
                      >
                        <CopyIcon size={14} />
                      </button>
                      <a
                        className="iconbtn"
                        title="Open"
                        href={`/${s.keyword}`}
                      >
                        <OpenIcon size={14} />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {toast ? (
        <div className="toast" role="status">
          <span className="toast-dot" />
          {toast}
        </div>
      ) : null}
    </>
  );
}
