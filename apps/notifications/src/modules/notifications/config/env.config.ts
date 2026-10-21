import { z } from "zod";

/** Left unset in some environments, where what it configures stays off instead of failing the boot. */
const unsetWhenEmpty = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(value => (value === "" ? undefined : value), schema.optional());

export const schema = z.object({
  NOVU_SECRET_KEY: z.string(),
  NOVU_MAILER_WORKFLOW_ID: z.string(),
  CONSOLE_API_BASE_URL: unsetWhenEmpty(z.string().url()),
  CONSOLE_API_INTERNAL_TOKEN: unsetWhenEmpty(z.string()),
  /** Kept short because the emails queued behind an alert wait while its feed entry is written. */
  CONSOLE_API_TIMEOUT_MS: z.number({ coerce: true }).int().positive().optional().default(2000),
  PROMOTIONAL_EMAIL_POSTAL_ADDRESS: unsetWhenEmpty(z.string())
});

export type NotificationEnvConfig = z.infer<typeof schema>;
