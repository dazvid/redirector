import { userService } from "@/features/users";
import { ok, rateLimited, toErrorResponse } from "@/lib/api-response";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Cap account creation per IP so signup can't be scripted into a flood of
// spam accounts.
const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** POST /api/auth/signup — create a regular (non-admin) account. Public. */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(
      `signup:${clientIp(request)}`,
      SIGNUP_LIMIT,
      SIGNUP_WINDOW_MS
    );
    if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

    const body = await request.json();
    const user = await userService.signUp(body);
    return ok(user, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
