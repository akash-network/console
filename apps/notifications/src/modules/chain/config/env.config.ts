import { z } from "zod";

export const schema = z.object({
  BLOCK_TIME_SEC: z.number({ coerce: true }).optional().default(6),
  RPC_NODE_ENDPOINT: z.string()
});

export type ChainEventsEnvConfig = z.infer<typeof schema>;
