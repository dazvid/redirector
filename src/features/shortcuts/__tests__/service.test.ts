import { describe, expect, it } from "vitest";
import { createShortcutService } from "@/features/shortcuts/service";
import {
  DuplicateKeywordError,
  ForbiddenError,
  ShortcutNotFoundError,
  ShortcutValidationError,
} from "@/features/shortcuts/errors";
import { createFakeShortcutRepository } from "./fake-repository";

const OWNER = { id: "fake-owner", isAdmin: false };
const OTHER_USER = { id: "other-user", isAdmin: false };
const ADMIN = { id: "admin-id", isAdmin: true };

function makeService(
  seed: Parameters<typeof createFakeShortcutRepository>[0] = []
) {
  const repository = createFakeShortcutRepository(seed);
  return { service: createShortcutService(repository), repository };
}

describe("createShortcut", () => {
  it("creates a shortcut with normalized keyword, owned by the creator", async () => {
    const { service } = makeService();
    const created = await service.createShortcut(
      { keyword: "  YouTube ", url: "https://www.youtube.com" },
      OWNER
    );
    expect(created.keyword).toBe("youtube");
    expect(created.url).toBe("https://www.youtube.com");
    expect(created.userId).toBe(OWNER.id);
    expect(created.visibility).toBe("PUBLIC");
  });

  it("respects an explicit PERSONAL visibility", async () => {
    const { service } = makeService();
    const created = await service.createShortcut(
      { keyword: "notes", url: "https://notes.example", visibility: "PERSONAL" },
      OWNER
    );
    expect(created.visibility).toBe("PERSONAL");
  });

  it("rejects duplicates with DuplicateKeywordError", async () => {
    const { service } = makeService([
      { keyword: "youtube", url: "https://www.youtube.com" },
    ]);
    await expect(
      service.createShortcut(
        { keyword: "YOUTUBE", url: "https://other.example" },
        OWNER
      )
    ).rejects.toBeInstanceOf(DuplicateKeywordError);
  });

  it("rejects invalid input with ShortcutValidationError", async () => {
    const { service } = makeService();
    await expect(
      service.createShortcut(
        { keyword: "bad word", url: "javascript:alert(1)" },
        OWNER
      )
    ).rejects.toBeInstanceOf(ShortcutValidationError);
  });
});

describe("listShortcuts", () => {
  const seed = [
    { keyword: "public-mine", url: "https://a.example", userId: OWNER.id, visibility: "PUBLIC" as const },
    { keyword: "personal-mine", url: "https://b.example", userId: OWNER.id, visibility: "PERSONAL" as const },
    { keyword: "public-theirs", url: "https://c.example", userId: OTHER_USER.id, visibility: "PUBLIC" as const },
    { keyword: "personal-theirs", url: "https://d.example", userId: OTHER_USER.id, visibility: "PERSONAL" as const },
  ];

  it("shows an anonymous viewer only public shortcuts", async () => {
    const { service } = makeService(seed);
    const keywords = (await service.listShortcuts(null)).map((s) => s.keyword);
    expect(keywords.sort()).toEqual(["public-mine", "public-theirs"]);
  });

  it("shows a signed-in viewer public shortcuts plus their own personal ones", async () => {
    const { service } = makeService(seed);
    const keywords = (await service.listShortcuts(OWNER)).map((s) => s.keyword);
    expect(keywords.sort()).toEqual(["personal-mine", "public-mine", "public-theirs"]);
  });

  it("shows an admin every shortcut regardless of owner or visibility", async () => {
    const { service } = makeService(seed);
    const keywords = (await service.listShortcuts(ADMIN)).map((s) => s.keyword);
    expect(keywords.sort()).toEqual([
      "personal-mine",
      "personal-theirs",
      "public-mine",
      "public-theirs",
    ]);
  });

  it("flags isMine/canManage correctly per viewer", async () => {
    const { service } = makeService(seed);
    const asOwner = await service.listShortcuts(OWNER);
    const mine = asOwner.find((s) => s.keyword === "public-mine");
    const theirs = asOwner.find((s) => s.keyword === "public-theirs");
    expect(mine?.isMine).toBe(true);
    expect(mine?.canManage).toBe(true);
    expect(theirs?.isMine).toBe(false);
    expect(theirs?.canManage).toBe(false);

    const asAdmin = await service.listShortcuts(ADMIN);
    expect(asAdmin.every((s) => s.canManage)).toBe(true);
  });
});

describe("resolveKeyword", () => {
  it("resolves a known keyword case-insensitively, regardless of visibility", async () => {
    const { service } = makeService([
      { keyword: "youtube", url: "https://www.youtube.com", visibility: "PERSONAL" as const },
    ]);
    const shortcut = await service.resolveKeyword("YouTube");
    expect(shortcut?.url).toBe("https://www.youtube.com");
  });

  it("returns null for unknown or empty keywords", async () => {
    const { service } = makeService();
    expect(await service.resolveKeyword("missing")).toBeNull();
    expect(await service.resolveKeyword("   ")).toBeNull();
  });
});

describe("updateShortcut", () => {
  it("lets the owner update the URL of their own shortcut", async () => {
    const { service } = makeService([
      { keyword: "youtube", url: "https://old.example", userId: OWNER.id },
    ]);
    const updated = await service.updateShortcut(
      "youtube",
      { url: "https://www.youtube.com" },
      OWNER
    );
    expect(updated.url).toBe("https://www.youtube.com");
    expect(updated.keyword).toBe("youtube");
  });

  it("lets an admin update someone else's shortcut", async () => {
    const { service } = makeService([
      { keyword: "youtube", url: "https://old.example", userId: OWNER.id },
    ]);
    const updated = await service.updateShortcut(
      "youtube",
      { url: "https://www.youtube.com" },
      ADMIN
    );
    expect(updated.url).toBe("https://www.youtube.com");
  });

  it("rejects a non-owner, non-admin with ForbiddenError", async () => {
    const { service } = makeService([
      { keyword: "youtube", url: "https://old.example", userId: OWNER.id },
    ]);
    await expect(
      service.updateShortcut("youtube", { url: "https://evil.example" }, OTHER_USER)
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("renames a keyword when the new keyword is free", async () => {
    const { service } = makeService([
      { keyword: "yt", url: "https://www.youtube.com", userId: OWNER.id },
    ]);
    const updated = await service.updateShortcut(
      "yt",
      { keyword: "youtube" },
      OWNER
    );
    expect(updated.keyword).toBe("youtube");
    expect(await service.resolveKeyword("yt")).toBeNull();
  });

  it("rejects renaming onto an existing keyword", async () => {
    const { service } = makeService([
      { keyword: "yt", url: "https://www.youtube.com", userId: OWNER.id },
      { keyword: "youtube", url: "https://www.youtube.com", userId: OWNER.id },
    ]);
    await expect(
      service.updateShortcut("yt", { keyword: "youtube" }, OWNER)
    ).rejects.toBeInstanceOf(DuplicateKeywordError);
  });

  it("allows a no-op rename to the same keyword", async () => {
    const { service } = makeService([
      { keyword: "youtube", url: "https://old.example", userId: OWNER.id },
    ]);
    const updated = await service.updateShortcut(
      "youtube",
      { keyword: "youtube", url: "https://www.youtube.com" },
      OWNER
    );
    expect(updated.url).toBe("https://www.youtube.com");
  });

  it("throws ShortcutNotFoundError for unknown keywords", async () => {
    const { service } = makeService();
    await expect(
      service.updateShortcut("missing", { url: "https://example.com" }, OWNER)
    ).rejects.toBeInstanceOf(ShortcutNotFoundError);
  });

  it("rejects an empty update payload", async () => {
    const { service } = makeService([
      { keyword: "youtube", url: "https://www.youtube.com", userId: OWNER.id },
    ]);
    await expect(
      service.updateShortcut("youtube", {}, OWNER)
    ).rejects.toBeInstanceOf(ShortcutValidationError);
  });
});

describe("deleteShortcut", () => {
  it("lets the owner remove their own shortcut", async () => {
    const { service, repository } = makeService([
      { keyword: "youtube", url: "https://www.youtube.com", userId: OWNER.id },
    ]);
    await service.deleteShortcut("youtube", OWNER);
    expect(repository.rows).toHaveLength(0);
  });

  it("lets an admin remove someone else's shortcut", async () => {
    const { service, repository } = makeService([
      { keyword: "youtube", url: "https://www.youtube.com", userId: OWNER.id },
    ]);
    await service.deleteShortcut("youtube", ADMIN);
    expect(repository.rows).toHaveLength(0);
  });

  it("rejects a non-owner, non-admin with ForbiddenError", async () => {
    const { service, repository } = makeService([
      { keyword: "youtube", url: "https://www.youtube.com", userId: OWNER.id },
    ]);
    await expect(
      service.deleteShortcut("youtube", OTHER_USER)
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.rows).toHaveLength(1);
  });

  it("throws ShortcutNotFoundError for unknown keywords", async () => {
    const { service } = makeService();
    await expect(service.deleteShortcut("missing", OWNER)).rejects.toBeInstanceOf(
      ShortcutNotFoundError
    );
  });
});

describe("refreshPreview wiring", () => {
  function makeServiceWithRefresher(
    seed: Parameters<typeof createFakeShortcutRepository>[0] = []
  ) {
    const repository = createFakeShortcutRepository(seed);
    const calls: Array<{ id: string; url: string }> = [];
    const refreshPreview = async (shortcut: { id: string; url: string }) => {
      calls.push({ id: shortcut.id, url: shortcut.url });
    };
    const service = createShortcutService(repository, { refreshPreview });
    return { service, calls };
  }

  it("triggers a refresh after creating a shortcut", async () => {
    const { service, calls } = makeServiceWithRefresher();
    const created = await service.createShortcut(
      { keyword: "youtube", url: "https://www.youtube.com" },
      OWNER
    );
    expect(calls).toEqual([{ id: created.id, url: created.url }]);
  });

  it("triggers a refresh when an update changes the URL", async () => {
    const { service, calls } = makeServiceWithRefresher([
      { keyword: "youtube", url: "https://old.example", userId: OWNER.id },
    ]);
    await service.updateShortcut("youtube", { url: "https://new.example" }, OWNER);
    expect(calls).toEqual([{ id: expect.any(String), url: "https://new.example" }]);
  });

  it("does not trigger a refresh when an update leaves the URL unchanged", async () => {
    const { service, calls } = makeServiceWithRefresher([
      { keyword: "youtube", url: "https://www.youtube.com", userId: OWNER.id },
    ]);
    await service.updateShortcut("youtube", { keyword: "yt" }, OWNER);
    expect(calls).toEqual([]);
  });

  it("does not let a rejecting refresher break createShortcut", async () => {
    const repository = createFakeShortcutRepository();
    const service = createShortcutService(repository, {
      refreshPreview: async () => {
        throw new Error("network is down");
      },
    });
    await expect(
      service.createShortcut({ keyword: "youtube", url: "https://www.youtube.com" }, OWNER)
    ).resolves.toMatchObject({ keyword: "youtube" });
  });
});
