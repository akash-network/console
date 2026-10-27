import { z } from "@hono/zod-openapi";

import { AkashAddressSchema, DseqSchema } from "@src/utils/schema";

export const DeploymentNameParamsSchema = z.object({
  owner: AkashAddressSchema,
  dseq: DseqSchema
});

export const DeploymentNameQuerySchema = z.object({
  userId: z.string().uuid().openapi({ description: "The user who set the alert asking for the name" }),
  organizationId: z.string().uuid().optional().openapi({ description: "The organization the alert is filed in, absent for an alert set before organizations" })
});

export const DeploymentNameResponseSchema = z.object({
  name: z.string().nullable()
});
