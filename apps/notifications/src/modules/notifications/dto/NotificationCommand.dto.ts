import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const NotificationCommandSchema = z.object({
  notificationChannelId: z.string(),
  payload: z.object({
    summary: z.string(),
    description: z.string()
  })
});

export class NotificationCommandDto extends createZodDto(NotificationCommandSchema) {}
