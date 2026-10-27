import { z } from "@hono/zod-openapi";

import { AkashAddressSchema, DseqSchema } from "@src/utils/schema";

export const DeploymentNameParamsSchema = z.object({
  owner: AkashAddressSchema,
  dseq: DseqSchema
});

export const DeploymentNameResponseSchema = z.object({
  name: z.string().nullable()
});
