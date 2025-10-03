import { z } from "zod";

export const schema = z.object({
  NOVU_SECRET_KEY: z.string(),
  NOVU_MAILER_WORKFLOW_ID: z.string(),
  AMPLITUDE_API_KEY: z.string(),
  AMPLITUDE_SAMPLING: z.number({ coerce: true }).optional().default(1)
});

export type NotificationEnvConfig = z.infer<typeof schema>;
