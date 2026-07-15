import bcrypt from "bcryptjs";
import { signupSchema } from "@/features/users/schema";
import { DuplicateUsernameError, UserValidationError } from "@/features/users/errors";
import type { User, UserRepository } from "@/features/users/repository";
import type { ZodError } from "zod";

const BCRYPT_COST = 12;

/**
 * A real cost-12 hash of a throwaway string. When authenticate() is called
 * for a username that doesn't exist, we still run bcrypt.compare against
 * this so the "no such user" path takes about as long as the "wrong
 * password" path — otherwise the timing difference leaks which usernames
 * exist.
 */
const DUMMY_PASSWORD_HASH =
  "$2a$12$5KKqqa.4NL6tsoOki6okAeemIc67oOFoBTmYEgmRUdWquIeJC3Eg2";

export type PublicUser = Omit<User, "passwordHash">;

function toValidationError(error: ZodError): UserValidationError {
  return new UserValidationError(error.issues.map((issue) => issue.message));
}

function withoutPasswordHash(user: User): PublicUser {
  const { passwordHash, ...rest } = user;
  return rest;
}

/** Shared by signUp and the admin bootstrap step so both hash at the same cost. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Business rules for user accounts. Passwords never leave this module in
 * plain text or as a hash — callers get back a PublicUser.
 */
export function createUserService(repository: UserRepository) {
  return {
    async signUp(input: unknown): Promise<PublicUser> {
      const parsed = signupSchema.safeParse(input);
      if (!parsed.success) throw toValidationError(parsed.error);

      const existing = await repository.findByUsername(parsed.data.username);
      if (existing) throw new DuplicateUsernameError(parsed.data.username);

      const passwordHash = await hashPassword(parsed.data.password);
      const user = await repository.create({
        username: parsed.data.username,
        passwordHash,
        isAdmin: false,
      });
      return withoutPasswordHash(user);
    },

    /** Returns the user (sans hash) if the password matches, else null. */
    async authenticate(
      username: string,
      password: string
    ): Promise<PublicUser | null> {
      const user = await repository.findByUsername(username.trim().toLowerCase());
      if (!user) {
        // Compare against a dummy hash so this path costs the same as a
        // real (but wrong-password) login — no username-enumeration oracle.
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        return null;
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      return valid ? withoutPasswordHash(user) : null;
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
