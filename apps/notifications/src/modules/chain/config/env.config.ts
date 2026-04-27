import { z } from "zod";

export const schema = z.object({
  BLOCK_TIME_SEC: z.number({ coerce: true }).optional().default(6),
  BLOCK_STALE_THRESHOLD_SEC: z.number({ coerce: true }).optional().default(300),
  RPC_NODE_ENDPOINT: z.string()
});

export type ChainEventsEnvConfig = z.infer<typeof schema>;
