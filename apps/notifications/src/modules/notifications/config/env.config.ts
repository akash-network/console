import { z } from "zod";

export const schema = z.object({
  NOVU_SECRET_KEY: z.string(),
  NOVU_MAILER_WORKFLOW_ID: z.string(),
  CONSOLE_API_BASE_URL: z.string().url().optional(),
  CONSOLE_API_INTERNAL_TOKEN: z.string().optional(),
  /** Kept short because the emails queued behind an alert wait while its feed entry is written. */
  CONSOLE_API_TIMEOUT_MS: z.number({ coerce: true }).int().positive().optional().default(2000)
});

export type NotificationEnvConfig = z.infer<typeof schema>;
