import { z } from "zod";

export const envSchema = z.object({
  API_NODE_ENDPOINT: z.string(),
  RPC_NODE_ENDPOINT: z.string(),
  CHAIN_INDEXER_POSTGRES_DB_URI: z.string()
});
