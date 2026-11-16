import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const ClosureAlertsDueSchema = z.object({
  notificationChannelId: z.string().uuid()
});

export class ClosureAlertsDueDto extends createZodDto(ClosureAlertsDueSchema) {}
