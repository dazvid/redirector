import type {
  Shortcut,
  ShortcutRepository,
  ShortcutVisibilityFilter,
  Visibility,
} from "@/features/shortcuts/repository";

interface SeedShortcut extends Pick<Shortcut, "keyword" | "url"> {
  userId?: string;
  ownerUsername?: string;
  category?: string;
  clickCount?: number;
  visibility?: Visibility;
}

/**
 * In-memory ShortcutRepository for unit tests. Mirrors the real
 * repository's contract (including the visibility filter) without
 * touching a database.
 */
export function createFakeShortcutRepository(
  seed: SeedShortcut[] = []
): ShortcutRepository & { rows: Shortcut[] } {
  let nextId = 1;
  const usernames = new Map<string, string>();
  const rows: Shortcut[] = seed.map((entry) => makeRow(entry));

  function makeRow(entry: SeedShortcut): Shortcut {
    const now = new Date();
    const userId = entry.userId ?? "fake-owner";
    usernames.set(userId, entry.ownerUsername ?? userId);
    return {
      id: `fake-${nextId++}`,
      keyword: entry.keyword,
      url: entry.url,
      category: entry.category ?? null,
      clickCount: entry.clickCount ?? 0,
      visibility: entry.visibility ?? "PUBLIC",
      userId,
      createdAt: now,
      updatedAt: now,
    };
  }

  function withOwner(row: Shortcut) {
    return { ...row, ownerUsername: usernames.get(row.userId) ?? row.userId };
  }

  function matchesFilter(row: Shortcut, filter: ShortcutVisibilityFilter): boolean {
    if (filter.includeAll) return true;
    if (row.visibility === "PUBLIC") return true;
    return row.userId === filter.viewerId;
  }

  return {
    rows,
    async list(filter) {
      return rows
        .filter((row) => matchesFilter(row, filter))
        .sort((a, b) => a.keyword.localeCompare(b.keyword))
        .map(withOwner);
    },
    async findByKeyword(keyword) {
      return rows.find((row) => row.keyword === keyword) ?? null;
    },
    async create(data) {
      const row = makeRow(data);
      rows.push(row);
      return row;
    },
    async update(id, data) {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) throw new Error(`No row with id ${id}`);
      if (data.keyword !== undefined) row.keyword = data.keyword;
      if (data.url !== undefined) row.url = data.url;
      if (data.category !== undefined) row.category = data.category;
      if (data.visibility !== undefined) row.visibility = data.visibility;
      row.updatedAt = new Date();
      return row;
    },
    async deleteById(id) {
      const index = rows.findIndex((candidate) => candidate.id === id);
      if (index === -1) throw new Error(`No row with id ${id}`);
      rows.splice(index, 1);
    },
    async incrementClicks(id) {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) throw new Error(`No row with id ${id}`);
      row.clickCount += 1;
    },
  };
}
