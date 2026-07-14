/**
 * Runs once when the server starts (both `next dev`/`next start` and the
 * standalone Docker image). Guarded to the Node runtime since this touches
 * Prisma, which doesn't run on the Edge runtime instrumentation is also
 * loaded into.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureBootstrapAdmin } = await import("@/lib/bootstrap-admin");
    await ensureBootstrapAdmin();
  }
}
