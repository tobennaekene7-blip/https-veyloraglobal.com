import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

// Backing table for express-session via connect-pg-simple. Column names and
// types match exactly what connect-pg-simple expects
// (https://github.com/voxpelli/node-connect-pg-simple#table-schema).
//
// Defined here — instead of relying on connect-pg-simple's own
// `createTableIfMissing` option — because that option reads a `table.sql`
// asset file at a path resolved relative to the package's own install
// location. That resolution breaks once esbuild bundles the whole API
// server into a single dist file: the bundled code no longer lives under
// node_modules/connect-pg-simple/, so the file read 404s (ENOENT) and the
// table never gets created. Managing the table here instead means it's
// auto-provisioned by the same `drizzle-kit push` step already wired into
// every deploy platform (Dockerfile/render.yaml), exactly like every other
// table in this project — no extra moving parts, and immune to how the
// server happens to be bundled.
export const sessionTable = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey().notNull(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);
