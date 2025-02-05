import { z } from "zod";

const DeploymentSettingSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  dseq: z.string(),
  autoTopUpEnabled: z.boolean(),
  estimatedTopUpAmount: z.number(),
  topUpFrequencyMs: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const DeploymentSettingResponseSchema = z.object({
  data: DeploymentSettingSchema
});

export const CreateDeploymentSettingRequestSchema = z.object({
  data: z.object({
    userId: z.string().openapi({
      description: "User ID"
    }),
    dseq: z.string().openapi({
      description: "Deployment sequence number"
    }),
    autoTopUpEnabled: z.boolean().default(false).openapi({
      description: "Whether auto top-up is enabled for this deployment"
    })
  })
});

export const UpdateDeploymentSettingRequestSchema = z.object({
  data: z.object({
    autoTopUpEnabled: z.boolean().openapi({
      description: "Whether auto top-up is enabled for this deployment"
    })
  })
});

export const FindDeploymentSettingParamsSchema = z.object({
  userId: z.string().openapi({
    description: "User ID"
  }),
  dseq: z.string().openapi({
    description: "Deployment sequence number"
  })
});

export type DeploymentSetting = z.infer<typeof DeploymentSettingSchema>;
export type DeploymentSettingResponse = z.infer<typeof DeploymentSettingResponseSchema>;
export type CreateDeploymentSettingRequest = z.infer<typeof CreateDeploymentSettingRequestSchema>;
export type UpdateDeploymentSettingRequest = z.infer<typeof UpdateDeploymentSettingRequestSchema>;
export type FindDeploymentSettingParams = z.infer<typeof FindDeploymentSettingParamsSchema>;
