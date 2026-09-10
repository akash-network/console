import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const API_MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");
export const INDEXER_MIGRATIONS_FOLDER = path.resolve(process.cwd(), "../indexer/drizzle");

export const USER_TEMPLATE_ENV_VAR = "TEST_DB_USER_TEMPLATE";
export const INDEXER_TEMPLATE_ENV_VAR = "TEST_DB_INDEXER_TEMPLATE";

export const TEMPLATE_NAME_PREFIX = "tpl_console_api";

/** Postgres serializes template creation cluster-wide, so concurrent runs coordinate on one advisory lock. */
export const TEMPLATE_ADVISORY_LOCK_KEY = 8_314_507_211;

export function buildTemplateName(role: "user" | "indexer", fingerprint: string) {
  return `${TEMPLATE_NAME_PREFIX}_${role}_${fingerprint}`;
}

export function fingerprintMigrations(...folders: string[]) {
  const hash = createHash("sha1");

  for (const folder of folders) {
    for (const file of readdirSync(folder).sort()) {
      if (!file.endsWith(".sql")) continue;
      hash.update(file);
      hash.update(readFileSync(path.join(folder, file)));
    }

    hash.update(readFileSync(path.join(folder, "meta", "_journal.json")));
  }

  return hash.digest("hex").slice(0, 12);
}
