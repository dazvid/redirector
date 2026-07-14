import { userService } from "@/features/users";
import { ok, toErrorResponse } from "@/lib/api-response";

/** POST /api/auth/signup — create a regular (non-admin) account. Public. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await userService.signUp(body);
    return ok(user, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
