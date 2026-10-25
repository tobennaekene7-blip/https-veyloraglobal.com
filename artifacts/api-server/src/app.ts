import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.SESSION_SECRET) {
  // Log the issue but don't crash — allows healthcheck to pass so Deploy Logs show up
  console.warn(
    "[WARN] SESSION_SECRET is not set. Using insecure fallback — set this in Railway Variables.",
  );
  process.env.SESSION_SECRET = "insecure-fallback-change-me";
}

const app: Express = express();

// Railway (and most PaaS hosts) terminate TLS at an edge proxy and forward
// plain HTTP to this container. Without this, Express doesn't know the
// original request was HTTPS, which can affect how it and downstream
// middleware (like the secure session cookie below) reason about the
// connection.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(
  express.json({
    // Raised from Express's 100kb default so Send Email attachments
    // (base64-encoded in the JSON body) have room — 15mb of base64 is
    // roughly 10-11mb of actual file content, well above Resend's own
    // per-email size ceiling, so this is the effective limit in practice.
    limit: "15mb",
    // Stash the raw request body alongside the parsed one so the Resend
    // inbound-email webhook route can verify its signature against the
    // exact bytes Resend sent (signature verification breaks if it's
    // computed over a re-serialized JSON object instead).
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Store sessions in Postgres instead of the default in-memory store, which
// leaks memory and loses every admin login on every restart/redeploy.
// Reuses the same connection pool @workspace/db already maintains, rather
// than opening a second one.
//
// The "session" table itself is defined as a normal Drizzle schema table
// (lib/db/src/schema/session.ts) and provisioned by the same `drizzle-kit
// push` step already wired into every deploy platform (Dockerfile/
// render.yaml) — NOT via connect-pg-simple's own `createTableIfMissing`
// option. That option reads a `table.sql` file at a path resolved relative
// to its own package location, which breaks once esbuild bundles the whole
// server into a single dist file (ENOENT: no such file or directory, open
// '.../dist/table.sql'), so the table would silently never get created in
// the actual production build.
//
// Background failures here (the periodic session-prune query, etc.) are
// reported through connect-pg-simple's own `errorLog` option rather than an
// emitted event, so they're routed to the app's logger here instead of
// `console.error`. The crash risk this guards against — an unhandled
// "error" event on the underlying Postgres connection pool taking down the
// whole Node process — is handled once, for every consumer of that shared
// pool (queries and sessions alike), by the listener on `pool` itself in
// @workspace/db (lib/db/src/index.ts).
const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  pool,
  tableName: "session",
  createTableIfMissing: false,
  errorLog: (...args) => {
    logger.error({ args }, "Session store error (non-fatal, app keeps running)");
  },
});

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24h
    },
  }),
);

app.use("/api", router);

// In production, serve the built React frontend
if (process.env.NODE_ENV === "production") {
  // The Vite build outputs to artifacts/veylora-global/dist/public relative to monorepo root
  // At runtime, dist/index.mjs sits in artifacts/api-server/dist/, so we go up 3 levels
  const frontendDist = path.resolve(__dirname, "../../../artifacts/veylora-global/dist/public");
  app.use(express.static(frontendDist));
  // Catch-all: let React Router handle client-side navigation
  // Express 5 + path-to-regexp 8 requires a named wildcard — bare "*" throws PathError
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
