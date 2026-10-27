import { z } from "zod";

import { unsetWhenEmpty } from "@src/lib/unset-when-empty/unset-when-empty";

export const schema = z.object({
  API_NODE_ENDPOINT: z.string(),
  CONSOLE_WEB_URL: z.string(),
  DEPLOYMENT_BALANCE_BLOCKS_THROTTLE: z.number({ coerce: true }).optional().default(10),
  CONSOLE_API_BASE_URL: unsetWhenEmpty(z.string().url()),
  CONSOLE_API_INTERNAL_TOKEN: unsetWhenEmpty(z.string()),
  /** Kept short because an alert's email waits on the lookup of the deployment's name. */
  CONSOLE_API_TIMEOUT_MS: z.number({ coerce: true }).int().positive().optional().default(2000)
});

export type AlertEnvConfig = z.infer<typeof schema>;
