import { describe, expect, it } from "vitest";
import { signupSchema, usernameSchema, passwordSchema } from "@/features/users/schema";

describe("usernameSchema", () => {
  it("accepts simple lowercase usernames", () => {
    expect(usernameSchema.parse("alice")).toBe("alice");
    expect(usernameSchema.parse("alice-2")).toBe("alice-2");
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(usernameSchema.parse("  Alice ")).toBe("alice");
  });

  it("rejects usernames shorter than 3 characters", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
  });

  it("rejects invalid characters", () => {
    for (const bad of ["has space", "slash/es", "émoji", ""]) {
      expect(usernameSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects usernames longer than 32 characters", () => {
    expect(usernameSchema.safeParse("a".repeat(33)).success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(32)).success).toBe(true);
  });
});

describe("passwordSchema", () => {
  it("accepts passwords of at least 8 characters", () => {
    expect(passwordSchema.safeParse("password").success).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("requires both username and password", () => {
    expect(signupSchema.safeParse({ username: "alice" }).success).toBe(false);
    expect(signupSchema.safeParse({ password: "password123" }).success).toBe(false);
  });
});
