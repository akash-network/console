import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const NotificationCommandSchema = z.object({
  channel: z.object({
    type: z.enum(['email']),
    address: z.string().email(),
  }),
  userId: z.string(),
  payload: z.string(),
});

export class NotificationCommandDto extends createZodDto(
  NotificationCommandSchema,
) {}
