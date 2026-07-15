import {
  createShortcutSchema,
  updateShortcutSchema,
} from "@/features/shortcuts/schema";
import {
  DuplicateKeywordError,
  ForbiddenError,
  ShortcutNotFoundError,
  ShortcutValidationError,
} from "@/features/shortcuts/errors";
import type {
  Shortcut,
  ShortcutRepository,
  ShortcutWithOwner,
} from "@/features/shortcuts/repository";
import type { ZodError } from "zod";

export interface Viewer {
  id: string;
  isAdmin: boolean;
}

export interface ShortcutServiceDeps {
  /**
   * Fire-and-forget preview-image refresh, called after create and after
   * an update that changes the URL. Injected (rather than imported
   * directly) so unit tests never make a real network call — see
   * features/shortcuts/index.ts for the production wiring.
   */
  refreshPreview?: (shortcut: Pick<Shortcut, "id" | "url">) => Promise<void>;
}

export interface ShortcutListItem extends ShortcutWithOwner {
  /** True when the viewer who called listShortcuts owns this row. */
  isMine: boolean;
  /** True when the viewer may edit/delete this row (owner, or admin). */
  canManage: boolean;
}

function toValidationError(error: ZodError): ShortcutValidationError {
  return new ShortcutValidationError(
    error.issues.map((issue) => issue.message)
  );
}

function assertCanManage(shortcut: Shortcut, actor: Viewer): void {
  if (actor.isAdmin || shortcut.userId === actor.id) return;
  throw new ForbiddenError("You can only edit or delete your own shortcuts");
}

/**
 * Business rules for shortcuts. All input crossing this boundary is
 * validated and normalized here, regardless of whether it arrived via
 * the REST API, a server component, or a future CLI.
 */
export function createShortcutService(
  repository: ShortcutRepository,
  deps: ShortcutServiceDeps = {}
) {
  return {
    /**
     * Admins see every shortcut; signed-in viewers see public shortcuts
     * plus their own; anonymous viewers (pass null) see public only.
     */
    async listShortcuts(viewer: Viewer | null): Promise<ShortcutListItem[]> {
      const rows = viewer?.isAdmin
        ? await repository.list({ includeAll: true })
        : await repository.list({ viewerId: viewer?.id });

      return rows.map((row) => {
        const isMine = viewer?.id === row.userId;
        return { ...row, isMine, canManage: isMine || Boolean(viewer?.isAdmin) };
      });
    },

    /**
     * Resolves a keyword to its shortcut, or null (used by the redirect
     * route). Not visibility-filtered — PERSONAL shortcuts are unlisted,
     * not access-controlled, so the redirect works for anyone.
     */
    async resolveKeyword(rawKeyword: string): Promise<Shortcut | null> {
      const keyword = rawKeyword.trim().toLowerCase();
      if (keyword.length === 0) return null;
      const shortcut = await repository.findByKeyword(keyword);
      if (shortcut) {
        await repository.incrementClicks(shortcut.id);
      }
      return shortcut;
    },

    async getShortcut(rawKeyword: string): Promise<Shortcut> {
      const shortcut = await repository.findByKeyword(
        rawKeyword.trim().toLowerCase()
      );
      if (!shortcut) throw new ShortcutNotFoundError(rawKeyword);
      return shortcut;
    },

    async createShortcut(input: unknown, owner: Viewer): Promise<Shortcut> {
      const parsed = createShortcutSchema.safeParse(input);
      if (!parsed.success) throw toValidationError(parsed.error);

      const existing = await repository.findByKeyword(parsed.data.keyword);
      if (existing) throw new DuplicateKeywordError(parsed.data.keyword);

      const created = await repository.create({ ...parsed.data, userId: owner.id });
      void deps.refreshPreview?.(created).catch(() => {});
      return created;
    },

    async updateShortcut(
      rawKeyword: string,
      input: unknown,
      actor: Viewer
    ): Promise<Shortcut> {
      const parsed = updateShortcutSchema.safeParse(input);
      if (!parsed.success) throw toValidationError(parsed.error);

      const current = await this.getShortcut(rawKeyword);
      assertCanManage(current, actor);

      if (parsed.data.keyword && parsed.data.keyword !== current.keyword) {
        const collision = await repository.findByKeyword(parsed.data.keyword);
        if (collision) throw new DuplicateKeywordError(parsed.data.keyword);
      }

      const updated = await repository.update(current.id, parsed.data);
      if (parsed.data.url && parsed.data.url !== current.url) {
        void deps.refreshPreview?.(updated).catch(() => {});
      }
      return updated;
    },

    async deleteShortcut(rawKeyword: string, actor: Viewer): Promise<void> {
      const current = await this.getShortcut(rawKeyword);
      assertCanManage(current, actor);
      await repository.deleteById(current.id);
    },
  };
}

export type ShortcutService = ReturnType<typeof createShortcutService>;
