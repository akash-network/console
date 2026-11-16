import { z } from "zod";

import { unsetWhenEmpty } from "@src/lib/unset-when-empty/unset-when-empty";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const schema = z.object({
  SENDGRID_API_KEY: z.string().min(1),
  SENDGRID_API_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().default("https://api.sendgrid.com")),
  SENDGRID_TIMEOUT_MS: z.preprocess(emptyToUndefined, z.number({ coerce: true }).int().positive().default(10_000)),
  EMAIL_FROM_ADDRESS: z.string().email(),
  EMAIL_FROM_NAME: unsetWhenEmpty(z.string()),
  CONSOLE_API_BASE_URL: unsetWhenEmpty(z.string().url()),
  CONSOLE_API_INTERNAL_TOKEN: unsetWhenEmpty(z.string()),
  /** Kept short because the emails queued behind an alert wait while its feed entry is written. */
  CONSOLE_API_TIMEOUT_MS: z.number({ coerce: true }).int().positive().optional().default(2000),
  PROMOTIONAL_EMAIL_POSTAL_ADDRESS: unsetWhenEmpty(z.string()),
  /** The same Console web URL alert emails link to, required wherever channel addresses are confirmed. */
  CONSOLE_WEB_URL: unsetWhenEmpty(z.string())
});

export type NotificationEnvConfig = z.infer<typeof schema>;
