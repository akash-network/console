import { createZodDto } from "nestjs-zod";
import { z } from "zod";

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
      .optional()
  })
});

export class NotificationCommandDto extends createZodDto(NotificationCommandSchema) {}
