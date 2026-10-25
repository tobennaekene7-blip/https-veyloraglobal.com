import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway (and most hosted PG providers) require SSL
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

// pg.Pool is an EventEmitter and emits "error" whenever an idle client in
// the pool hits a problem (a dropped connection, a transient DNS failure
// like the Railway private-networking / alpine-musl issue fixed in the
// Dockerfile, etc). node-postgres's own docs are explicit that an
// unhandled "error" event on a Pool crashes the entire process — with no
// listener here, any one of those transient hiccups takes the whole app
// down instead of just failing the query that was in flight. This is the
// single pool shared by every consumer (Drizzle queries and the
// Postgres-backed session store alike), so this one listener covers all
// of them.
pool.on("error", (err) => {
  console.error("Postgres pool error (non-fatal, app keeps running):", err);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
