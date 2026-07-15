import { NextResponse } from "next/server";
import {
  DuplicateKeywordError,
  ForbiddenError,
  ShortcutNotFoundError,
  ShortcutValidationError,
} from "@/features/shortcuts/errors";
import {
  DuplicateUsernameError,
  UserValidationError,
} from "@/features/users/errors";
import { UnauthorizedError } from "@/lib/auth";

/**
 * Consistent JSON envelope for every API route:
 *   success → { "data": ... }
 *   failure → { "error": { "code", "message", "details"? } }
 *
 * New features should route their domain errors through toErrorResponse
 * so clients see uniform error shapes.
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ShortcutValidationError || error instanceof UserValidationError) {
    return errorJson(400, "VALIDATION_ERROR", error.message, error.issues);
  }
  if (error instanceof UnauthorizedError) {
    return errorJson(401, "UNAUTHORIZED", error.message);
  }
  if (error instanceof ForbiddenError) {
    return errorJson(403, "FORBIDDEN", error.message);
  }
  if (error instanceof ShortcutNotFoundError) {
    return errorJson(404, "NOT_FOUND", error.message);
  }
  if (error instanceof DuplicateKeywordError) {
    return errorJson(409, "DUPLICATE_KEYWORD", error.message);
  }
  if (error instanceof DuplicateUsernameError) {
    return errorJson(409, "DUPLICATE_USERNAME", error.message);
  }

  console.error("Unhandled API error:", error);
  return errorJson(500, "INTERNAL_ERROR", "Something went wrong");
}

function errorJson(
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status }
  );
}

/** 429 with a Retry-After header, for rate-limited endpoints. */
export function rateLimited(retryAfterSeconds: number): NextResponse {
  const response = errorJson(
    429,
    "RATE_LIMITED",
    "Too many requests. Please try again later."
  );
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}
