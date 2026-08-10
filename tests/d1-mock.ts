/**
 * In-memory D1 mock for tests. Wraps bun:sqlite with a D1-compatible API
 * (prepare → bind → first/all/run), so the app's db.ts module works
 * unchanged in the test environment without a Wrangler/Miniflare D1 binding.
 *
 * Usage:
 *   const d1 = createD1Mock();
 *   await applyMigrations(d1);
 *   initDb(d1);
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { Database as SqliteDB } from "bun:sqlite";

type SqlBindings = string | number | bigint | boolean | null | Uint8Array;

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: { changes: number; last_row_id: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

/**
 * Minimal D1-shaped object — only the methods db.ts calls (prepare, exec).
 * Cast to `D1Database` at the call site since the shapes are compatible.
 */
export interface D1Mock {
  prepare(sql: string): D1PreparedStatement;
  exec(sql: string): Promise<void>;
  /** Internal handle for cleanup. */
  __db: Database;
}

export function createD1Mock(): D1Mock {
  const db = new SqliteDB(":memory:");
  // D1 uses async semantics; bun:sqlite is sync. The mock wraps calls in
  // resolved promises so `await` in db.ts works without modification.
  const prepare = (sql: string): D1PreparedStatement => {
    let bindings: SqlBindings[] = [];
    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        bindings = values as SqlBindings[];
        return stmt;
      },
      async first<T = unknown>(): Promise<T | null> {
        const prepared = db.prepare(sql);
        return (prepared.get(...bindings) as T | null) ?? null;
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        const prepared = db.prepare(sql);
        const results = prepared.all(...bindings) as T[];
        return { results, success: true, meta: { changes: 0, last_row_id: 0 } };
      },
      async run<T = unknown>(): Promise<D1Result<T>> {
        const prepared = db.prepare(sql);
        const info = prepared.run(...bindings);
        return {
          results: [],
          success: true,
          meta: { changes: info.changes, last_row_id: info.lastInsertRowid as number },
        };
      },
    };
    return stmt;
  };

  return {
    prepare,
    async exec(sql: string): Promise<void> {
      db.exec(sql);
    },
    __db: db,
  };
}

/** Read migration files and apply them to the D1 mock. */
export async function applyMigrations(d1: D1Mock): Promise<void> {
  const dir = join(process.cwd(), "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf-8");
    await d1.exec(sql);
  }
}

/** Close the underlying sqlite connection (for afterAll cleanup). */
export function closeD1Mock(d1: D1Mock): void {
  d1.__db.close();
}
