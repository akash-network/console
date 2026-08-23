import { z } from "zod";

import { DseqSchema } from "@src/utils/schema";
import { MAX_RUNTIME_LIMIT_HOURS, MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "./runtime-limit";

const DeploymentSettingSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  dseq: DseqSchema,
  autoTopUpEnabled: z.boolean(),
  estimatedTopUpAmount: z.number(),
  topUpFrequencyMs: z.number(),
  runtimeLimitHours: z.number().int().nullable().openapi({
    description: "Runtime limit in hours chosen at deployment creation, or null for always-on funding"
  }),
  runtimeEndsAt: z.string().datetime().nullable().openapi({
    description: "When the runtime limit is reached, anchored at lease start; null until the lease starts or when no limit is set"
  }),
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
    autoTopUpEnabled: z.boolean().optional().openapi({
      description: "Whether auto top-up is enabled for this deployment"
    }),
    runtimeLimitHours: z
      .number()
      .int()
      .min(1)
      .max(MAX_RUNTIME_LIMIT_HOURS)
      .optional()
      .openapi({
        description: `Runtime limit in hours, counted from lease start. On a deployment with no limit yet it may be at most ${MAX_RUNTIME_LIMIT_INCREMENT_HOURS}. Extending an existing limit must raise it by at most ${MAX_RUNTIME_LIMIT_INCREMENT_HOURS} hours per request; send the new total rather than the increment. Lowering or removing a limit is not supported.`
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
