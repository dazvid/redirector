import { z } from "zod";

/**
 * Keywords that collide with application routes and must never be
 * registered as shortcuts. Extend this list when adding new top-level
 * routes (and add a test in schema.test.ts).
 */
export const RESERVED_KEYWORDS: readonly string[] = [
  "admin",
  "api",
  "login",
  "logout",
  "signup",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "_next",
];

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Zod runs refinements even when earlier checks fail, so parse defensively. */
function hasAllowedProtocol(value: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const keywordSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Keyword is required")
  .max(64, "Keyword must be 64 characters or fewer")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)"
  )
  .refine((keyword) => !RESERVED_KEYWORDS.includes(keyword), {
    message: "This keyword is reserved",
  });

export const urlSchema = z
  .string()
  .trim()
  .url("Enter a valid URL, including http:// or https://")
  .max(2048, "URL must be 2048 characters or fewer")
  .refine(hasAllowedProtocol, {
    message: "Only http and https URLs are allowed",
  });

/**
 * Categories are free-form labels used to group shortcuts in the
 * directory and console. Optional and normalized to a trimmed string.
 */
export const categorySchema = z
  .string()
  .trim()
  .max(48, "Category must be 48 characters or fewer")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const createShortcutSchema = z.object({
  keyword: keywordSchema,
  url: urlSchema,
  category: categorySchema,
});

export const updateShortcutSchema = z
  .object({
    keyword: keywordSchema.optional(),
    url: urlSchema.optional(),
    category: categorySchema,
  })
  .refine(
    (data) =>
      data.keyword !== undefined ||
      data.url !== undefined ||
      data.category !== undefined,
    { message: "Provide a keyword, URL, or category to update" }
  );

export type CreateShortcutInput = z.infer<typeof createShortcutSchema>;
export type UpdateShortcutInput = z.infer<typeof updateShortcutSchema>;
