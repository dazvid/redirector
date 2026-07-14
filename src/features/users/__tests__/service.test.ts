import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { createUserService } from "@/features/users/service";
import { DuplicateUsernameError, UserValidationError } from "@/features/users/errors";
import { createFakeUserRepository } from "./fake-repository";

function makeService(
  seed: Array<{ username: string; passwordHash: string; isAdmin?: boolean }> = []
) {
  const repository = createFakeUserRepository(seed);
  return { service: createUserService(repository), repository };
}

describe("signUp", () => {
  it("creates a user with a normalized username and hashed password", async () => {
    const { service, repository } = makeService();
    const user = await service.signUp({ username: "  Alice ", password: "password123" });
    expect(user.username).toBe("alice");
    expect(user).not.toHaveProperty("passwordHash");

    const stored = repository.rows[0];
    expect(stored.passwordHash).not.toBe("password123");
    expect(await bcrypt.compare("password123", stored.passwordHash)).toBe(true);
  });

  it("never sets isAdmin for self-signup", async () => {
    const { service } = makeService();
    const user = await service.signUp({ username: "alice", password: "password123" });
    expect(user.isAdmin).toBe(false);
  });

  it("rejects duplicate usernames with DuplicateUsernameError", async () => {
    const { service } = makeService([{ username: "alice", passwordHash: "hash" }]);
    await expect(
      service.signUp({ username: "ALICE", password: "password123" })
    ).rejects.toBeInstanceOf(DuplicateUsernameError);
  });

  it("rejects invalid input with UserValidationError", async () => {
    const { service } = makeService();
    await expect(
      service.signUp({ username: "a", password: "short" })
    ).rejects.toBeInstanceOf(UserValidationError);
  });
});

describe("authenticate", () => {
  it("resolves the user when the password matches", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    const { service } = makeService([{ username: "alice", passwordHash, isAdmin: true }]);

    const user = await service.authenticate("Alice", "password123");
    expect(user?.username).toBe("alice");
    expect(user?.isAdmin).toBe(true);
  });

  it("returns null for a wrong password", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    const { service } = makeService([{ username: "alice", passwordHash }]);

    expect(await service.authenticate("alice", "wrong-password")).toBeNull();
  });

  it("returns null for an unknown username", async () => {
    const { service } = makeService();
    expect(await service.authenticate("nobody", "password123")).toBeNull();
  });
});
