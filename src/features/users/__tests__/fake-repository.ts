import type { User, UserRepository } from "@/features/users/repository";

/**
 * In-memory UserRepository for unit tests. Mirrors the real repository's
 * contract without touching a database.
 */
export function createFakeUserRepository(
  seed: Array<Pick<User, "username" | "passwordHash"> & { isAdmin?: boolean }> = []
): UserRepository & { rows: User[] } {
  let nextId = 1;
  const rows: User[] = seed.map((entry) => makeRow(entry));

  function makeRow(entry: {
    username: string;
    passwordHash: string;
    isAdmin?: boolean;
  }): User {
    return {
      id: `fake-${nextId++}`,
      username: entry.username,
      passwordHash: entry.passwordHash,
      isAdmin: entry.isAdmin ?? false,
      createdAt: new Date(),
    };
  }

  return {
    rows,
    async findByUsername(username) {
      return rows.find((row) => row.username === username) ?? null;
    },
    async findById(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
    async create(data) {
      const row = makeRow(data);
      rows.push(row);
      return row;
    },
    async upsertById(id, data) {
      const existing = rows.find((row) => row.id === id);
      if (existing) {
        existing.username = data.username;
        existing.passwordHash = data.passwordHash;
        existing.isAdmin = data.isAdmin;
        return existing;
      }
      const row: User = { id, ...data, createdAt: new Date() };
      rows.push(row);
      return row;
    },
  };
}
