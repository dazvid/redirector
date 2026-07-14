import { userRepository } from "@/features/users";
import { hashPassword } from "@/features/users/service";

const ADMIN_USER_ID = "admin";

/**
 * Keeps the bootstrap admin account (fixed id "admin" — the same row the
 * initial migration backfilled pre-existing shortcuts onto) in sync with
 * ADMIN_USERNAME / ADMIN_PASSWORD_HASH on every server start. Run once from
 * instrumentation.ts. Prefers ADMIN_PASSWORD_HASH (bcrypt); falls back to
 * hashing the plain-text ADMIN_PASSWORD for local dev convenience.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  if (!username) return;

  const passwordHash = process.env.ADMIN_PASSWORD_HASH
    ? process.env.ADMIN_PASSWORD_HASH
    : process.env.ADMIN_PASSWORD
      ? await hashPassword(process.env.ADMIN_PASSWORD)
      : undefined;
  if (!passwordHash) return;

  await userRepository.upsertById(ADMIN_USER_ID, {
    username: username.trim().toLowerCase(),
    passwordHash,
    isAdmin: true,
  });
}
