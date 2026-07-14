# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
# libc6-compat: needed by Next's native deps. openssl: Prisma's Linux
# query engine links against it at runtime.
RUN apk add --no-cache libc6-compat openssl

# ---- deps: full install (incl. devDependencies — needed by builder & migrator) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate the Prisma client and produce the Next.js standalone build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- migrator: applies pending migrations, then exits. Run once before `app`
# starts. Also doubles as a one-off runner for `npx tsx prisma/seed.ts` since
# it carries the full devDependencies and a generated Prisma Client. ----
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
RUN npx prisma generate
CMD ["npm", "run", "db:migrate:deploy"]

# ---- runner: minimal production image, no devDependencies, no build toolchain ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
