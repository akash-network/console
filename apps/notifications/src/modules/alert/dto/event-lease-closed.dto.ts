import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const EventLeaseClosedSchema = z.object({
  module: z.literal("market"),
  action: z.literal("lease-closed"),
  owner: z.string(),
  dseq: z.string(),
  provider: z.string(),
  reason: z.union([z.string(), z.number()])
});

export class EventLeaseClosedDto extends createZodDto(EventLeaseClosedSchema) {}
