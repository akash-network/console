import { z } from "zod";

/** Treats an empty string as absent so `CHAIN_INDEXER_API_BASE_URL=` in an env file keeps delegation off. */
const emptyStringAsUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

export const envSchema = z.object({
  CHAIN_INDEXER_API_BASE_URL: z.preprocess(emptyStringAsUndefined, z.string().url().optional())
});

export type ChainIndexerConfig = z.infer<typeof envSchema>;
