import { z } from "zod";

export const schema = z.object({
  API_NODE_ENDPOINT: z.string(),
  CONSOLE_WEB_URL: z.string(),
  DEPLOYMENT_BALANCE_BLOCKS_THROTTLE: z.number({ coerce: true }).optional().default(10)
});

export type AlertEnvConfig = z.infer<typeof schema>;
