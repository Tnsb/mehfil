import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH ?? "./data/table.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Reuse one connection across Next.js hot reloads in dev.
const globalForDb = globalThis as unknown as { __tableDb?: ReturnType<typeof create> };

function create() {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db = globalForDb.__tableDb ?? (globalForDb.__tableDb = create());
export * as tables from "./schema";
