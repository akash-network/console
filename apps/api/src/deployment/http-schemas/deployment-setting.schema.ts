import { z } from "zod";

import { DseqSchema } from "@src/utils/schema";

const DeploymentSettingSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  dseq: DseqSchema,
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
    dseq: DseqSchema.openapi({
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
  dseq: DseqSchema.openapi({
    description: "Deployment sequence number"
  })
});

export const FindDeploymentSettingV2ParamsSchema = z.object({
  dseq: DseqSchema.openapi({
    description: "Deployment sequence number"
  })
});

export const FindDeploymentSettingV2QuerySchema = z.object({
  userId: z.string().uuid().optional().openapi({
    description: "User ID. Defaults to the current authenticated user if not provided"
  })
});

export const CreateDeploymentSettingV2RequestSchema = z.object({
  data: z.object({
    dseq: DseqSchema.openapi({
      description: "Deployment sequence number"
    }),
    autoTopUpEnabled: z.boolean().default(false).openapi({
      description: "Whether auto top-up is enabled for this deployment"
    }),
    userId: z.string().uuid().optional().openapi({
      description: "User ID. Defaults to the current authenticated user if not provided"
    })
  })
});

export type DeploymentSetting = z.infer<typeof DeploymentSettingSchema>;
export type DeploymentSettingResponse = z.infer<typeof DeploymentSettingResponseSchema>;
export type CreateDeploymentSettingRequest = z.infer<typeof CreateDeploymentSettingRequestSchema>;
export type UpdateDeploymentSettingRequest = z.infer<typeof UpdateDeploymentSettingRequestSchema>;
export type FindDeploymentSettingParams = z.infer<typeof FindDeploymentSettingParamsSchema>;
export type FindDeploymentSettingV2Params = z.infer<typeof FindDeploymentSettingV2ParamsSchema>;
export type FindDeploymentSettingV2Query = z.infer<typeof FindDeploymentSettingV2QuerySchema>;
export type CreateDeploymentSettingV2Request = z.infer<typeof CreateDeploymentSettingV2RequestSchema>;
