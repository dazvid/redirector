import type { PrismaClient } from "@prisma/client";

export interface Shortcut {
  id: string;
  keyword: string;
  url: string;
  category: string | null;
  clickCount: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  previewImageUrl: string | null;
  previewFetchedAt: Date | null;
}

export interface ShortcutWithOwner extends Shortcut {
  ownerUsername: string;
}

/**
 * Data-access contract for shortcuts. The service depends on this
 * interface (not on Prisma), so tests can inject an in-memory fake and
 * a future storage swap only touches this file.
 */
export interface ShortcutRepository {
  /** Every shortcut is listed for every viewer — there's no visibility restriction. */
  list(): Promise<ShortcutWithOwner[]>;
  findByKeyword(keyword: string): Promise<Shortcut | null>;
  create(data: {
    keyword: string;
    url: string;
    category?: string;
    userId: string;
  }): Promise<Shortcut>;
  update(
    id: string,
    data: { keyword?: string; url?: string; category?: string }
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
    async list() {
      const rows = await prisma.shortcut.findMany({
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
