# Debian-based (glibc), not node:20-alpine (musl). Alpine's musl libc has a
# well-documented bug resolving Railway's private-networking hostnames
# (*.railway.internal, IPv6-only) — it fails intermittently under concurrent
# lookups with "getaddrinfo ENOTFOUND postgres.railway.internal" even though
# the hostname is valid and the DB is reachable. Symptom: most requests work
# fine, but anything touching the DB-backed session store randomly 500s or
# hangs. Swapping to a glibc base image is the standard fix.
FROM node:20-bookworm-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace files
COPY . .

# Install all dependencies
RUN pnpm install --no-frozen-lockfile

# Build frontend (React Vite) then API server (Express)
RUN BASE_PATH=/ pnpm --filter @workspace/veylora-global run build
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production

EXPOSE 8080

# Push the Drizzle schema to DATABASE_URL before starting the server, so a
# brand-new deploy against a fresh/empty Postgres database (a new Railway
# project, Render, or any other platform) self-provisions its tables
# automatically instead of booting into a 500 on every DB-backed route.
# Safe to run on every boot, including redeploys of an already-running app:
# it's a no-op when there's no schema diff, and `drizzle-kit push` refuses
# (rather than silently applying) any change that would lose existing data
# when it can't prompt for confirmation in this non-interactive context.
CMD ["sh", "-c", "pnpm --filter @workspace/db run push; node --enable-source-maps artifacts/api-server/dist/index.mjs"]
