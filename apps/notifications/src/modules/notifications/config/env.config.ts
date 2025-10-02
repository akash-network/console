import { z } from "zod";

export const schema = z.object({
  NOVU_SECRET_KEY: z.string(),
  NOVU_MAILER_WORKFLOW_ID: z.string(),
  AMPLITUDE_API_KEY: z.string(),
  AMPLITUDE_SAMPLING: z.string().optional().default("1.0")
});

export type NotificationEnvConfig = z.infer<typeof schema>;
