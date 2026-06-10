import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const EventLeaseReclaimStartedSchema = z.object({
  module: z.literal("market"),
  action: z.literal("lease-reclaim-started"),
  owner: z.string(),
  dseq: z.string(),
  provider: z.string(),
  // On-chain enum/Long JSON encoding is ambiguous: `reason` may be the enum
  // number, its numeric string, or its proto name; `deadline` (a Long unix
  // timestamp) may be a number or string. Normalization happens in the service.
  reason: z.union([z.string(), z.number()]),
  deadline: z.union([z.string(), z.number()])
});

export class EventLeaseReclaimStartedDto extends createZodDto(EventLeaseReclaimStartedSchema) {}
