import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { userService } from "@/features/users";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Throttle credential checks per IP to blunt brute-force / credential
// stuffing. A rejected attempt surfaces as an ordinary sign-in failure.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * The fields our Credentials provider puts on the JWT/session. Auth.js's
 * own Session/User/JWT types don't reflect this — ambient module
 * augmentation against @auth/core's types doesn't merge reliably under
 * this project's moduleResolution ("bundler") for @auth/core's deep
 * subpath exports, so rather than fight that, every consumer goes through
 * requireSession()/getViewer() below instead of touching `session.user`
 * directly. The runtime shape IS correct (see the jwt/session callbacks) —
 * this is purely about TypeScript visibility.
 */
export interface AppUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

/**
 * Auth.js configuration: any row in the User table can sign in via the
 * credentials provider (self-signup creates one; the bootstrap admin from
 * env vars is another — see lib/bootstrap-admin.ts). Sessions are
 * stateless JWTs, so middleware can check them without a database
 * round trip; `id`/`isAdmin` are copied onto the token/session below so
 * route handlers and services can make ownership decisions without an
 * extra lookup.
 *
 * To move to SSO later, add a provider here (e.g. GitHub, Google) —
 * nothing else in the app needs to change, since all consumers go
 * through auth() / requireSession() / getViewer().
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (request instanceof Request) {
          const limit = rateLimit(
            `login:${clientIp(request)}`,
            LOGIN_LIMIT,
            LOGIN_WINDOW_MS
          );
          if (!limit.allowed) return null;
        }

        const username = String(credentials?.username ?? "");
        const password = String(credentials?.password ?? "");
        if (!username || !password) return null;

        const user = await userService.authenticate(username, password);
        if (!user) return null;
        return { id: user.id, name: user.username, isAdmin: user.isAdmin };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as unknown as { isAdmin: boolean }).isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const extra = token as unknown as { id: string; isAdmin: boolean };
        const user = session.user as unknown as { id: string; isAdmin: boolean };
        user.id = extra.id;
        user.isAdmin = extra.isAdmin;
      }
      return session;
    },
  },
});

/**
 * Defense in depth: route handlers call this even though middleware
 * also gates the same paths. Returns the authenticated user or throws.
 */
export async function requireSession(): Promise<{ user: AppUser }> {
  const viewer = await getViewer();
  if (!viewer) {
    throw new UnauthorizedError();
  }
  return { user: viewer };
}

/** Returns the signed-in user, or null for an anonymous request. */
export async function getViewer(): Promise<AppUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  // id/isAdmin are added by the session callback above but aren't part of
  // Auth.js's own (unaugmented) User type; `name` is, and carries the
  // username — see authorize()'s return value.
  const extra = session.user as unknown as { id: string; isAdmin: boolean };
  return { id: extra.id, username: session.user.name ?? "", isAdmin: extra.isAdmin };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}
