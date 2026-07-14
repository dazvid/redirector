/**
 * Domain errors thrown by the users service. Route handlers map these to
 * HTTP status codes in lib/api-response.ts, mirroring the shortcuts feature.
 */

export class UserValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "UserValidationError";
    this.issues = issues;
  }
}

export class DuplicateUsernameError extends Error {
  constructor(username: string) {
    super(`"${username}" is already taken`);
    this.name = "DuplicateUsernameError";
  }
}
