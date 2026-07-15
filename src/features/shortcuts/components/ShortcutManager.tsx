"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/Icons";

interface ShortcutRow {
  id: string;
  keyword: string;
  url: string;
  category: string | null;
  clickCount: number;
  ownerUsername: string;
  isMine: boolean;
  canManage: boolean;
}

interface ApiError {
  code: string;
  message: string;
  details?: string[];
}

// Starter suggestions for the category datalist — not a restriction, just
// autocomplete. Any free-text value is accepted (see schema.ts's categorySchema).
const SUGGESTED_CATEGORIES = [
  "Eng",
  "Docs",
  "Design",
  "People",
  "Ops",
  "Product",
  "Comms",
];
const UNCATEGORIZED = "Other";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: ApiError };
    return (
      body.error?.details?.join(" ") ?? body.error?.message ?? "Request failed"
    );
  } catch {
    return "Request failed";
  }
}

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
 * CRUD console for shortcuts (the "Console" direction). Talks to the
 * REST API (not directly to the database) so the interface exercises the
 * same code paths as any external API consumer. Every shortcut is listed;
 * `canManage` (owner or admin) controls whether edit/delete show for a row.
 */
export function ShortcutManager({ initialKeyword }: { initialKeyword: string }) {
  const [shortcuts, setShortcuts] = useState<ShortcutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Filter / sort
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sort, setSort] = useState<"pop" | "az">("pop");

  // Create form
  const [addOpen, setAddOpen] = useState(Boolean(initialKeyword));
  const [newKeyword, setNewKeyword] = useState(initialKeyword);
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/shortcuts");
    if (!response.ok) {
      setError(await readError(response));
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { data: ShortcutRow[] };
    setShortcuts(body.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function flashToast(message: string) {
    setToast(message);
    window.clearTimeout((flashToast as unknown as { t?: number }).t);
    (flashToast as unknown as { t?: number }).t = window.setTimeout(
      () => setToast(null),
      1900
    );
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of shortcuts) set.add(s.category ?? UNCATEGORIZED);
    return ["All", ...Array.from(set).sort()];
  }, [shortcuts]);

  // Datalist suggestions: starter list plus whatever's actually in use —
  // free text is always accepted, this is just autocomplete.
  const categorySuggestions = useMemo(() => {
    const set = new Set(SUGGESTED_CATEGORIES);
    for (const s of shortcuts) if (s.category) set.add(s.category);
    return Array.from(set).sort();
  }, [shortcuts]);

  const visible = useMemo(() => {
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
    return sort === "az"
      ? [...filtered].sort((a, b) => a.keyword.localeCompare(b.keyword))
      : [...filtered].sort((a, b) => b.clickCount - a.clickCount);
  }, [shortcuts, query, activeCategory, sort]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    const response = await fetch("/api/shortcuts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: newKeyword,
        url: newUrl,
        category: newCategory,
      }),
    });

    setCreating(false);
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    flashToast(`Added go/${newKeyword.trim().toLowerCase()}`);
    setNewKeyword("");
    setNewUrl("");
    setNewCategory("");
    setAddOpen(false);
    await refresh();
  }

  function startEdit(shortcut: ShortcutRow) {
    setEditingId(shortcut.id);
    setEditKeyword(shortcut.keyword);
    setEditUrl(shortcut.url);
    setEditCategory(shortcut.category ?? "");
    setError(null);
  }

  async function handleSave(originalKeyword: string) {
    setSaving(true);
    setError(null);

    const response = await fetch(
      `/api/shortcuts/${encodeURIComponent(originalKeyword)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: editKeyword,
          url: editUrl,
          category: editCategory,
        }),
      }
    );

    setSaving(false);
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    flashToast("Saved changes");
    setEditingId(null);
    await refresh();
  }

  async function handleDelete(keyword: string) {
    if (!window.confirm(`Delete the shortcut go/${keyword}?`)) return;
    setError(null);

    const response = await fetch(
      `/api/shortcuts/${encodeURIComponent(keyword)}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    flashToast(`Deleted go/${keyword}`);
    await refresh();
  }

  return (
    <>
      <datalist id="category-suggestions">
        {categorySuggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="console-head">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setAddOpen((v) => !v)}
        >
          <PlusIcon size={15} />
          Add shortcut
        </button>
      </div>

      {addOpen ? (
        <form className="add-form" onSubmit={handleCreate}>
          <div className="add-grid">
            <div className="field kw-field">
              <label htmlFor="add-kw">Keyword</label>
              <div className="prefixed">
                <span className="kw">go/</span>
                <input
                  id="add-kw"
                  className="plain mono"
                  placeholder="figma"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field url-field">
              <label htmlFor="add-url">Destination URL</label>
              <input
                id="add-url"
                className="input mono"
                type="url"
                placeholder="https://…"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                required
              />
            </div>
            <div className="field cat-field">
              <label htmlFor="add-cat">Category</label>
              <input
                id="add-cat"
                className="input"
                list="category-suggestions"
                placeholder="e.g. Eng"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </div>
            <div className="add-actions">
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </form>
      ) : null}

      <div className="console-toolbar">
        <div className="search">
          <SearchIcon />
          <input
            className="plain"
            placeholder="Filter by keyword, URL, or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter shortcuts"
          />
        </div>
        <div className="seg-toggle" role="group" aria-label="Sort">
          <button
            type="button"
            className={`segb${sort === "pop" ? " on" : ""}`}
            onClick={() => setSort("pop")}
          >
            Popular
          </button>
          <button
            type="button"
            className={`segb${sort === "az" ? " on" : ""}`}
            onClick={() => setSort("az")}
          >
            A–Z
          </button>
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

      {error && !addOpen ? <p className="error-text">{error}</p> : null}

      <div className="console-grid-head">
        <span>Keyword</span>
        <span>Destination</span>
        <span>Category</span>
        <span>Owner</span>
        <span className="ralign">Opens</span>
        <span />
      </div>

      {loading ? (
        <p className="empty">Loading shortcuts…</p>
      ) : visible.length === 0 ? (
        <p className="empty">No shortcuts match “{query}”.</p>
      ) : (
        <div className="console-rows">
          {visible.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className="edit-row">
                <div className="prefixed">
                  <span className="kw">go/</span>
                  <input
                    className="plain mono"
                    value={editKeyword}
                    onChange={(e) => setEditKeyword(e.target.value)}
                    aria-label="Keyword"
                  />
                </div>
                <input
                  className="input mono edit-url"
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  aria-label="URL"
                />
                <input
                  className="input"
                  style={{ flex: "0 0 130px" }}
                  list="category-suggestions"
                  placeholder="e.g. Eng"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  aria-label="Category"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleSave(s.keyword)}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingId(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div key={s.id} className="data-row">
                <span className="kw mono">go/{s.keyword}</span>
                <span className="dest mono trunc">{hostOf(s.url)}</span>
                <span>
                  <span className="tag tag-neutral">
                    {s.category ?? UNCATEGORIZED}
                  </span>
                </span>
                <span className="dest mono trunc">
                  {s.isMine ? "you" : s.ownerUsername}
                </span>
                <span className="opens mono ralign">
                  {formatCount(s.clickCount)}
                </span>
                <span className="row-actions">
                  {s.canManage ? (
                    <>
                      <button
                        type="button"
                        className="iconbtn"
                        title="Edit"
                        onClick={() => startEdit(s)}
                      >
                        <PencilIcon size={14} />
                      </button>
                      <button
                        type="button"
                        className="iconbtn danger"
                        title="Delete"
                        onClick={() => handleDelete(s.keyword)}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </>
                  ) : null}
                </span>
              </div>
            )
          )}
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
