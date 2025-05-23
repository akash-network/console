require("@akashnetwork/env-loader");

const { Client } = require("pg");
const { URL } = require("url");
const pino = require("pino");
const { z } = require("zod");

const envSchema = z.object({
  POSTGRES_BASE_URL: z.string(),
  EVENT_BROKER_POSTGRES_URI: z.string(),
  NOTIFICATIONS_POSTGRES_URL: z.string()
});

const env = envSchema.parse(process.env);

const logger = pino().child({ context: "INIT_DB" });

async function createDatabaseIfNotExists(baseUrl, targetDbUrl) {
  const targetDbName = new URL(targetDbUrl).pathname.slice(1);

  const client = new Client({ connectionString: baseUrl });
  await client.connect();

  const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [targetDbName]);

  if (res.rowCount === 0) {
    logger.info(`Creating database: ${targetDbName}`);
    await client.query(`CREATE DATABASE "${targetDbName}"`);
  } else {
    logger.info(`Database already exists: ${targetDbName}`);
  }

  await client.end();
}

(async () => {
  const baseUrl = env.POSTGRES_BASE_URL;
  const dbs = [env.EVENT_BROKER_POSTGRES_URI, env.NOTIFICATIONS_POSTGRES_URL];

  for (const dbUrl of dbs) {
    await createDatabaseIfNotExists(baseUrl, dbUrl);
  }

  logger.info("✅ Done");
})();
