import { z } from "zod";

export const envSchema = z.object({
  CHAIN_INDEXER_POSTGRES_DB_URI: z.string(),
  RPC_NODE_ENDPOINT: z.string().url(),
  REST_API_NODE_URL: z.string().url()
});
