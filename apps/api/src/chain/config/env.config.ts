import { z } from "zod";

export const envSchema = z.object({
  CHAIN_INDEXER_POSTGRES_DB_URI: z.string()
});
