import type { PrismaClient } from "@prisma/client";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: Date;
}

/**
 * Data-access contract for users. The service depends on this interface
 * (not on Prisma), so tests can inject an in-memory fake.
 */
export interface UserRepository {
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: { username: string; passwordHash: string; isAdmin?: boolean }): Promise<User>;
  /** Used by the admin bootstrap step to keep the seeded admin's credentials in sync with env vars. */
  upsertById(
    id: string,
    data: { username: string; passwordHash: string; isAdmin: boolean }
  ): Promise<User>;
}

export function createPrismaUserRepository(prisma: PrismaClient): UserRepository {
  return {
    findByUsername(username) {
      return prisma.user.findUnique({ where: { username } });
    },
    findById(id) {
      return prisma.user.findUnique({ where: { id } });
    },
    create(data) {
      return prisma.user.create({ data });
    },
    upsertById(id, data) {
      return prisma.user.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      });
    },
  };
}
