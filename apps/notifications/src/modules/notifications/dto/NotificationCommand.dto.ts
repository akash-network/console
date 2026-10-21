import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { ALERT_ACTIVITY_TYPES } from "../services/activity-feed-client/activity-feed-client.service";

/** Dropped rather than rejected when malformed, so a bad feed entry can never stop its email. */
const AlertFeedEntrySchema = z
  .object({
    type: z.enum(ALERT_ACTIVITY_TYPES),
    alertId: z.string().uuid(),
    userId: z.string().uuid(),
    organizationId: z.string().uuid().nullable(),
    projectId: z.string().uuid().nullable(),
    dedupeKey: z.string().min(1),
    dseq: z.string().min(1).optional()
  })
  .optional()
  .catch(undefined);

/** The one-click URL goes verbatim into an email header, so only printable ASCII without spaces is allowed. */
const HeaderSafeHttpsUrlSchema = z
  .string()
  .url()
  .startsWith("https://")
  .regex(/^[\x21-\x7e]+$/, "Must contain only printable ASCII characters and no spaces");

export const EmailUnsubscribeSchema = z
  .object({
    url: HeaderSafeHttpsUrlSchema.describe("https URL of the unsubscribe page linked from the email footer"),
    oneClickUrl: HeaderSafeHttpsUrlSchema.describe("https URL of the endpoint that takes the RFC 8058 one-click unsubscribe POST")
  })
  .describe("Marks the email as promotional: it gets an unsubscribe footer, the postal address and one-click unsubscribe headers");

export type EmailUnsubscribe = z.infer<typeof EmailUnsubscribeSchema>;

const NotificationCommandSchema = z.object({
  notificationChannelId: z.string(),
  notificationId: z.string().optional(),
  payload: z.object({
    summary: z.string(),
    description: z.string(),
    code: z.string().optional(),
    actions: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url()
        })
      )
      .optional(),
    feedEntry: AlertFeedEntrySchema
  }),
  unsubscribe: EmailUnsubscribeSchema.optional()
});

export type AlertFeedEntry = NonNullable<z.infer<typeof AlertFeedEntrySchema>>;

export class NotificationCommandDto extends createZodDto(NotificationCommandSchema) {}
