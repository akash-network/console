import { z } from "zod";

export const schema = z.object({
  NOVU_SECRET_KEY: z.string(),
  NOVU_MAILER_WORKFLOW_ID: z.string()
});

export type NotificationEnvConfig = z.infer<typeof schema>;
