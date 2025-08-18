import { z } from "zod";

export const schema = z.object({
  BLOCK_TIME_SEC: z.number({ coerce: true }).optional().default(6),
  RPC_NODE_ENDPOINT: z.string(),
  USE_PROXY_URLS: z.enum(["true", "false"]).optional().default("false"),
  PROXY_RPC_URL: z.string().optional().default("https://rpc.akt.dev/rpc")
});

export type ChainEventsEnvConfig = z.infer<typeof schema>;
