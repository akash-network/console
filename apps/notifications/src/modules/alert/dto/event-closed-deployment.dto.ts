import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const EventCloseDeploymentSchema = z.object({
  module: z.literal("deployment"),
  action: z.literal("deployment-closed"),
  dseq: z.string(),
  owner: z.string()
});

export class EventClosedDeploymentDto extends createZodDto(EventCloseDeploymentSchema) {}
