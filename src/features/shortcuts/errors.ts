/**
 * Domain errors thrown by the shortcuts service. Route handlers map
 * these to HTTP status codes in one place (lib/api-response.ts) so the
 * service layer stays transport-agnostic and unit-testable.
 */

export class ShortcutValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "ShortcutValidationError";
    this.issues = issues;
  }
}

export class DuplicateKeywordError extends Error {
  constructor(keyword: string) {
    super(`A shortcut for "${keyword}" already exists`);
    this.name = "DuplicateKeywordError";
  }
}

export class ShortcutNotFoundError extends Error {
  constructor(keyword: string) {
    super(`No shortcut found for "${keyword}"`);
    this.name = "ShortcutNotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that") {
    super(message);
    this.name = "ForbiddenError";
  }
}
