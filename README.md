# go/links

Keyword shortcuts that redirect to saved URLs. Visit `/{keyword}` (e.g. `/youtube`) to be redirected to its saved URL. Anyone can sign up; each shortcut belongs to whoever created it, and is either **Public** (listed for everyone) or **Personal** (unlisted — the redirect still works for anyone, it's just left out of other users' directory/console). Shortcuts are managed through a REST API and an authenticated admin console.

## Quick start

The app needs Postgres. The easiest local source is the `db` service in `docker-compose.yml`:

```bash
cp .env.docker.example .env.docker   # then edit POSTGRES_PASSWORD, AUTH_SECRET, ADMIN_PASSWORD_HASH
# docker-compose.dev.yml opts in to publishing Postgres on localhost:5432 —
# not loaded by default, since exposing the DB port isn't something a
# deployment should do without asking for it.
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker up -d db

cp .env.example .env                 # match DATABASE_URL's password to POSTGRES_PASSWORD above
npm install
npx prisma migrate dev --name init
npm run db:seed                      # optional: seeds ~30 categorized shortcuts
npm run dev
```

Open http://localhost:3000, create an account at `/signup` (or sign in at `/login` with the bootstrap admin — see Authentication below), and manage entries at `/admin`.

## Running the full stack in Docker

`docker-compose.yml` brings up Postgres, the app, a one-shot migration step, and a Caddy TLS proxy in front:

```bash
cp .env.docker.example .env.docker   # set POSTGRES_PASSWORD, AUTH_SECRET, ADMIN_PASSWORD_HASH
docker compose --env-file .env.docker up --build
```

- **App**: https://localhost — Caddy terminates TLS and reverse-proxies to the `app` container. There's no domain configured, so Caddy issues a self-signed cert from its own internal CA; your browser will warn until you trust it (`docker compose exec proxy cat /data/caddy/pki/authorities/local/root.crt` to export it, or click through the warning for local use).
- **migrate**: runs `prisma migrate deploy` once against `db`, then exits; `app` won't start until it succeeds.
- **db**: Postgres 16, persisted in the `pgdata` volume. Not exposed to the host by default — only the `app` container can reach it. Add `-f docker-compose.dev.yml` (see Quick Start above) to publish `localhost:5432` for local `npm run dev` against the same database.
- Generate `AUTH_SECRET` with `openssl rand -base64 32`, and `ADMIN_PASSWORD_HASH` with `node -e "console.log(require('bcryptjs').hashSync('your-password', 12))"` — then double every `$` in the hash to `$$` in `.env.docker` (Compose interpolates `$` in env files, which otherwise truncates the hash).
- Requires Docker Compose v2.20+ (for `depends_on.condition: service_completed_successfully`).
- For a real domain instead of self-signed local TLS, point DNS at the host and replace `Caddyfile`'s `:443 { tls internal ... }` block with `yourdomain.com { reverse_proxy app:3000 }` — Caddy handles Let's Encrypt automatically.

## REST API

All responses use a consistent envelope: `{ "data": ... }` on success, `{ "error": { "code", "message" } }` on failure.

| Method | Route | Auth | Behavior |
|---|---|---|---|
| GET | `/{keyword}` | public | 302 redirect to the saved URL (works for Personal shortcuts too) |
| GET | `/api/shortcuts` | public, viewer-aware | List shortcuts the caller may see: public + own personal if signed in, everything if admin |
| GET | `/api/shortcuts/{keyword}` | public | Fetch one shortcut |
| POST | `/api/shortcuts` | required | Create, owned by the caller (`409` on duplicate keyword) |
| PUT | `/api/shortcuts/{keyword}` | required, owner or admin | Update keyword/URL/category/visibility (`403` otherwise) |
| DELETE | `/api/shortcuts/{keyword}` | required, owner or admin | Delete (`403` otherwise) |
| POST | `/api/auth/signup` | public | Create a regular (non-admin) account (`409` on duplicate username) |

```bash
# Example: create a shortcut (after signing in, using the session cookie)
curl -X POST http://localhost:3000/api/shortcuts \
  -H "Content-Type: application/json" \
  -b "$SESSION_COOKIE" \
  -d '{"keyword": "youtube", "url": "https://www.youtube.com"}'
```

## Architecture

Three thin layers, so logic is testable and diffs stay reviewable:

```
Route handler   src/app/api/**            HTTP only: parse, call service, map errors
  → Service     src/features/*/service.ts Business rules: validation, uniqueness
    → Repository src/features/*/repository.ts  Prisma queries only
```

- **Feature folders** (`src/features/shortcuts/`) keep a feature's schema, service, repository, components, and tests together. New capabilities get their own folder.
- **Services receive a repository via factory injection**, so unit tests use the in-memory fake in `__tests__/fake-repository.ts` — no database needed.
- **`src/features/shortcuts/index.ts` is the composition root** that wires Prisma into the service for app code.
- **Domain errors** (`errors.ts`) are mapped to HTTP statuses in one place: `src/lib/api-response.ts`.

## Authentication

Auth.js (NextAuth v5), credentials provider backed by the `User` table, JWT sessions carrying `id`/`isAdmin`. Consumers get these via `getViewer()`/`requireSession()` in `src/lib/auth.ts` rather than touching `session.user` directly — ambient TS module augmentation against `@auth/core`'s types doesn't merge reliably under this project's `moduleResolution`, so those two helpers are the typed boundary instead.

- **Self-signup** (`/signup` → `POST /api/auth/signup`) creates a regular account. Regular users can create shortcuts and edit/delete their own.
- **Bootstrap admin**: `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` (or plain-text `ADMIN_PASSWORD` for local dev) in env vars are upserted into a fixed-id `User` row (`isAdmin: true`) on every server start — see `src/lib/bootstrap-admin.ts`, called from `src/instrumentation.ts`. Admins can edit/delete *any* shortcut, not just their own.
- `src/middleware.ts` gates `/admin` (redirect to `/login`) and mutating `/api/shortcuts` calls (401 JSON). Ownership beyond "signed in" (owner-or-admin) is enforced in the service layer (`ForbiddenError` → 403), not middleware.
- Route handlers also call `requireSession()` — defense in depth, and it's what the tests exercise.
- To move to SSO, add a provider in `src/lib/auth.ts`; nothing else changes.

## Testing

```bash
npm run test        # vitest, no database required
npm run typecheck
```

CI (`.github/workflows/ci.yml`) runs `prisma generate → typecheck → test` on every PR.

## Adding a new feature (checklist)

1. Create `src/features/<name>/` with `schema.ts`, `errors.ts`, `repository.ts`, `service.ts`, `index.ts`, and `__tests__/`.
2. Add the Prisma model and a migration (`npx prisma migrate dev`).
3. Add thin route handlers under `src/app/api/<name>/` that call the service and use `ok()` / `toErrorResponse()`.
4. If routes must be protected, add them to the `middleware.ts` matcher *and* call `requireSession()` in handlers.
5. If the feature introduces a new top-level page route, add its path to `RESERVED_KEYWORDS` in `src/features/shortcuts/schema.ts` (a test enforces the list).

## Deploying

Use the Docker Compose stack above (`docker-compose.yml` + `Caddyfile` + `Dockerfile`) as-is, or as a template for your own infra. `next.config.ts` builds a `standalone` output so the runtime image only needs `node server.js` plus the traced `node_modules` — no build toolchain in the final image.
