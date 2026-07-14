/**
 * Composition root for the shortcuts feature: wires the Prisma
 * repository into the service. App code imports from here; tests
 * import createShortcutService directly and inject a fake repository.
 */
import { prisma } from "@/lib/db";
import { createPrismaShortcutRepository } from "@/features/shortcuts/repository";
import { createShortcutService } from "@/features/shortcuts/service";

export const shortcutService = createShortcutService(
  createPrismaShortcutRepository(prisma)
);
