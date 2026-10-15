/** Direct database access for assertions and fixtures (local stack only). */
import { execFileSync } from "node:child_process";

const DB = process.env.LOCAL_DB_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";

export function sql<T = Record<string, unknown>>(query: string): T[] {
  const out = execFileSync("psql", [DB, "-qtAX", "-v", "ON_ERROR_STOP=1", "-c", `select coalesce(json_agg(t), '[]') from (${query}) t`], {
    encoding: "utf8",
  });
  return JSON.parse(out.trim() || "[]") as T[];
}

export function exec(statement: string) {
  execFileSync("psql", [DB, "-qtAX", "-v", "ON_ERROR_STOP=1", "-c", statement], { encoding: "utf8" });
}
