/**
 * Composition root for the users feature: wires the Prisma repository
 * into the service. App code imports from here; tests import
 * createUserService directly and inject a fake repository.
 */
import { prisma } from "@/lib/db";
import { createPrismaUserRepository } from "@/features/users/repository";
import { createUserService } from "@/features/users/service";

export const userRepository = createPrismaUserRepository(prisma);
export const userService = createUserService(userRepository);
