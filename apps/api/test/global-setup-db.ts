import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import {
  API_MIGRATIONS_FOLDER,
  buildTemplateName,
  fingerprintMigrations,
  INDEXER_MIGRATIONS_FOLDER,
  INDEXER_TEMPLATE_ENV_VAR,
  TEMPLATE_ADVISORY_LOCK_KEY,
  TEMPLATE_NAME_PREFIX,
  USER_TEMPLATE_ENV_VAR
} from "./services/test-database-templates";

export async function setup() {
  const postgresUri = process.env.POSTGRES_URI || "postgres://postgres:password@localhost:5432";
  const fingerprint = fingerprintMigrations(API_MIGRATIONS_FOLDER, INDEXER_MIGRATIONS_FOLDER);
  const userTemplate = buildTemplateName("user", fingerprint);
  const indexerTemplate = buildTemplateName("indexer", fingerprint);
  const admin = postgres(postgresUri, { max: 1, onnotice: () => {} });

  try {
    await admin`SELECT pg_advisory_lock(${TEMPLATE_ADVISORY_LOCK_KEY})`;

    try {
      await ensureTemplate(admin, postgresUri, userTemplate, API_MIGRATIONS_FOLDER);
      await ensureTemplate(admin, postgresUri, indexerTemplate, INDEXER_MIGRATIONS_FOLDER);
      await dropTemplatesFromEarlierMigrations(admin, [userTemplate, indexerTemplate]);
    } finally {
      await admin`SELECT pg_advisory_unlock(${TEMPLATE_ADVISORY_LOCK_KEY})`;
    }
  } finally {
    await admin.end();
  }

  process.env[USER_TEMPLATE_ENV_VAR] = userTemplate;
  process.env[INDEXER_TEMPLATE_ENV_VAR] = indexerTemplate;
}

async function ensureTemplate(admin: postgres.Sql, postgresUri: string, name: string, migrationsFolder: string) {
  const [existing] = await admin<{ datistemplate: boolean }[]>`SELECT datistemplate FROM pg_database WHERE datname = ${name}`;

  if (existing?.datistemplate) {
    return;
  }

  if (existing) {
    await dropTemplate(admin, name);
  }

  await admin`CREATE DATABASE ${admin(name)}`;

  const migrationClient = postgres(`${postgresUri}/${name}`, { max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(migrationClient), { migrationsFolder });
  } catch (error) {
    await migrationClient.end();
    await dropTemplate(admin, name);
    throw error;
  }

  await migrationClient.end();
  await admin`ALTER DATABASE ${admin(name)} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`;
}

async function dropTemplatesFromEarlierMigrations(admin: postgres.Sql, keep: string[]) {
  const stale = await admin<{ datname: string }[]>`
    SELECT datname FROM pg_database
    WHERE datname LIKE ${`${TEMPLATE_NAME_PREFIX}%`} AND datname <> ALL(${admin.array(keep)})
  `;

  for (const { datname } of stale) {
    await dropTemplate(admin, datname);
  }
}

async function dropTemplate(admin: postgres.Sql, name: string) {
  await admin`ALTER DATABASE ${admin(name)} WITH IS_TEMPLATE false ALLOW_CONNECTIONS true`;
  await admin`DROP DATABASE IF EXISTS ${admin(name)}`;
}
