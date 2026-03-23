import { z } from "zod";

export const envSchema = z.object({
  CHAIN_INDEXER_POSTGRES_DB_URI: z.string(),
  REST_API_NODE_URL: z.string().url()
});
