import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const EventProviderMaintenanceOpenedSchema = z.object({
  module: z.literal("provider"),
  action: z.literal("provider-maintenance-opened"),
  maintenance_id: z.union([z.string(), z.number()]).transform(String),
  provider: z.string(),
  maintenance_type: z.union([z.string(), z.number()]).transform(String),
  starts_at: z.string().datetime(),
  expected_ends_at: z.string().datetime(),
  metadata_hash: z.string().optional()
});

export class EventProviderMaintenanceOpenedDto extends createZodDto(EventProviderMaintenanceOpenedSchema) {}
