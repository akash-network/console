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
  })
});

export type AlertFeedEntry = NonNullable<z.infer<typeof AlertFeedEntrySchema>>;

export class NotificationCommandDto extends createZodDto(NotificationCommandSchema) {}
