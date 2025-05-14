import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const ChainBlockCreatedSchema = z.object({
  height: z.number({ coerce: true })
});

export class ChainBlockCreatedDto extends createZodDto(ChainBlockCreatedSchema) {}
