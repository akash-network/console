import { z } from "zod";

export const envSchema = z.object({
  CHAIN_INDEXER_POSTGRES_DB_URI: z.string(),
  REST_API_NODE_URL: z.string().url(),
  BOUNDED_CHAIN_QUERY_TIMEOUT_MS: z.number({ coerce: true }).int().positive().optional().default(10_000)
});
