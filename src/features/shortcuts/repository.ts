import type { PrismaClient } from "@prisma/client";

export type Visibility = "PUBLIC" | "PERSONAL";

export interface Shortcut {
  id: string;
  keyword: string;
  url: string;
  category: string | null;
  clickCount: number;
  visibility: Visibility;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  previewImageUrl: string | null;
  previewFetchedAt: Date | null;
}

export interface ShortcutWithOwner extends Shortcut {
  ownerUsername: string;
}

export interface ShortcutVisibilityFilter {
  /** Admins see every shortcut regardless of viewerId/ownership. */
  includeAll?: boolean;
  /** Signed-in viewer: PUBLIC shortcuts plus any they own. Omit entirely for an anonymous viewer (PUBLIC only). */
  viewerId?: string;
}

/**
 * Data-access contract for shortcuts. The service depends on this
 * interface (not on Prisma), so tests can inject an in-memory fake and
 * a future storage swap only touches this file.
 */
export interface ShortcutRepository {
  /** Which rows come back is entirely determined by `filter` — see ShortcutVisibilityFilter. */
  list(filter: ShortcutVisibilityFilter): Promise<ShortcutWithOwner[]>;
  findByKeyword(keyword: string): Promise<Shortcut | null>;
  create(data: {
    keyword: string;
    url: string;
    category?: string;
    visibility: Visibility;
    userId: string;
  }): Promise<Shortcut>;
  update(
    id: string,
    data: { keyword?: string; url?: string; category?: string; visibility?: Visibility }
  ): Promise<Shortcut>;
  deleteById(id: string): Promise<void>;
  /** Fire-and-forget usage counter, bumped by the redirect route. */
  incrementClicks(id: string): Promise<void>;
  /** System-derived write (see features/shortcuts/preview.ts) — not part of the user-facing update() path. */
  setPreviewImage(id: string, previewImageUrl: string | null): Promise<void>;
}

export function createPrismaShortcutRepository(
  prisma: PrismaClient
): ShortcutRepository {
  return {
    async list(filter) {
      const where = filter.includeAll
        ? undefined
        : filter.viewerId
          ? { OR: [{ visibility: "PUBLIC" as const }, { userId: filter.viewerId }] }
          : { visibility: "PUBLIC" as const };

      const rows = await prisma.shortcut.findMany({
        where,
        orderBy: { keyword: "asc" },
        include: { user: { select: { username: true } } },
      });
      return rows.map(({ user, ...row }) => ({ ...row, ownerUsername: user.username }));
    },
    findByKeyword(keyword) {
      return prisma.shortcut.findUnique({ where: { keyword } });
    },
    create(data) {
      return prisma.shortcut.create({ data });
    },
    update(id, data) {
      return prisma.shortcut.update({ where: { id }, data });
    },
    async deleteById(id) {
      await prisma.shortcut.delete({ where: { id } });
    },
    async incrementClicks(id) {
      await prisma.shortcut.update({
        where: { id },
        data: { clickCount: { increment: 1 } },
      });
    },
    async setPreviewImage(id, previewImageUrl) {
      await prisma.shortcut.update({
        where: { id },
        data: { previewImageUrl, previewFetchedAt: new Date() },
      });
    },
  };
}
