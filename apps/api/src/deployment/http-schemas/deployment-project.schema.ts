import { z } from "@hono/zod-openapi";

import { DseqSchema } from "@src/utils/schema";

export const DeploymentProjectParamsSchema = z.object({
  dseq: DseqSchema.describe("Deployment sequence number")
});

export const UpdateDeploymentProjectRequestSchema = z.object({
  data: z.object({
    projectId: z.string().uuid()
  })
});

export const UpdateDeploymentProjectResponseSchema = z.object({
  data: z.object({
    dseq: DseqSchema,
    projectId: z.string().uuid()
  })
});

export const GetDeploymentLocationResponseSchema = z.object({
  data: z.object({
    organizationId: z.string().uuid(),
    organizationSlug: z.string(),
    projectId: z.string().uuid().nullable()
  })
});

export type UpdateDeploymentProjectRequest = z.infer<typeof UpdateDeploymentProjectRequestSchema>;
export type UpdateDeploymentProjectResponse = z.infer<typeof UpdateDeploymentProjectResponseSchema>;
export type GetDeploymentLocationResponse = z.infer<typeof GetDeploymentLocationResponseSchema>;
