import { DeploymentInfoSchema } from "@akashnetwork/http-sdk";
import { z } from "zod";

import { SignTxResponseOutputSchema } from "@src/billing/http-schemas/tx.schema";
import { MAX_SUBMITTED_SDL_LENGTH } from "@src/deployment/config/sdl.config";
import { openApiExampleAddress } from "@src/utils/constants";
import { AkashAddressSchema, DseqSchema } from "@src/utils/schema";
import { LeaseStatusResponseSchema } from "./lease.schema";
import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "./runtime-limit";

const DeploymentLeaseSchema = z.object({
  id: z.object({
    owner: z.string(),
    dseq: DseqSchema,
    gseq: z.number(),
    oseq: z.number(),
    provider: z.string(),
    bseq: z.number()
  }),
  state: z.string(),
  price: z.object({
    denom: z.string(),
    amount: z.string()
  }),
  created_at: z.string(),
  closed_on: z.string(),
  reason: z.string().optional(),
  status: z.nullable(LeaseStatusResponseSchema)
});

export const DeploymentResponseSchema = z.object({
  deployment: z.object({
    id: z.object({
      owner: z.string(),
      dseq: DseqSchema
    }),
    state: z.string(),
    hash: z.string(),
    created_at: z.string()
  }),
  leases: z.array(DeploymentLeaseSchema),
  escrow_account: z.object({
    id: z.object({
      scope: z.string(),
      xid: z.string()
    }),
    state: z.object({
      owner: z.string(),
      state: z.string(),
      transferred: z.array(
        z.object({
          denom: z.string(),
          amount: z.string()
        })
      ),
      settled_at: z.string(),
      funds: z.array(
        z.object({
          denom: z.string(),
          amount: z.string()
        })
      ),
      deposits: z.array(
        z.object({
          owner: z.string(),
          height: z.string(),
          source: z.string(),
          balance: z.object({
            denom: z.string(),
            amount: z.string()
          })
        })
      )
    })
  })
});

const DeploymentLeaseListItemSchema = DeploymentResponseSchema.extend({
  leases: z.array(DeploymentLeaseSchema.omit({ status: true }))
});

const ConsoleSettingsSchema = z.object({
  sdl: z.string().openapi({
    description: "The SDL the console stored for this deployment. Re-serialized YAML, so not byte-identical to the submitted document."
  }),
  manifestVersion: z.string().openapi({
    description: "Base64 of the manifest version this deployment commits on chain. Deliberately not a hash of the `sdl` above."
  })
});

export const GetDeploymentResponseSchema = z.object({
  data: DeploymentResponseSchema.extend({
    consoleSettings: ConsoleSettingsSchema.nullable().openapi({
      description: "What the console recorded for this deployment, or null when it recorded nothing."
    })
  })
});

/** POST /v1/leases answers with the deployment as the chain describes it, without the console's own record. */
export const CreateLeaseResponseSchema = z.object({
  data: DeploymentResponseSchema
});

export const GetDeploymentParamsSchema = z.object({
  dseq: DseqSchema.describe("Deployment sequence number")
});

export const CreateDeploymentRequestSchema = z.object({
  data: z.object({
    sdl: z.string().max(MAX_SUBMITTED_SDL_LENGTH),
    sealedSecrets: z.string().optional().openapi({
      description:
        "Values for the `ac-secret://NAME` references in `sdl`, sealed for this account as a compact JWE whose plaintext is a flat name-to-value JSON object. Seal it against the key and claims published by GET /v1/sdl-secrets-context. Every referenced name must have a value here and every value here must be referenced, so a typo on either side is refused rather than ignored. The count of values and the size of each are both capped; a value is measured as its JSON-encoded length, so a value containing quotes, backslashes or control characters carries fewer raw bytes than one that does not. Exceeding either cap fails with a 400 naming the limit and its configured value. There is no plaintext alternative, and no endpoint ever returns a stored value."
    }),
    deposit: z.number().optional().openapi({
      deprecated: true,
      description: "Deprecated and ignored. The platform funds every deployment automatically from your account credits."
    }),
    runtimeLimitHours: z
      .number()
      .int()
      .min(1)
      .max(MAX_RUNTIME_LIMIT_INCREMENT_HOURS)
      .optional()
      .openapi({
        description: `Optional runtime limit in hours (1 to ${MAX_RUNTIME_LIMIT_INCREMENT_HOURS}), counted from lease start. Automatic funding keeps the deployment running until the limit, then the deployment is closed automatically and unused funds are returned. Extend a limit with PATCH /v2/deployment-settings/{dseq}. Omit for always-on funding.`
      })
  })
});

export const CreateDeploymentResponseSchema = z.object({
  data: z.object({
    dseq: DseqSchema,
    manifest: z.string(),
    signTx: SignTxResponseOutputSchema.shape.data
  })
});

export const CloseDeploymentParamsSchema = z.object({
  dseq: DseqSchema.describe("Deployment sequence number")
});

export const CloseDeploymentResponseSchema = z.object({
  data: z.object({
    success: z.boolean()
  })
});

export const DepositDeploymentRequestSchema = z.object({
  data: z.object({
    dseq: DseqSchema.describe("Deployment sequence number"),
    deposit: z.number().describe("Amount to deposit in dollars (e.g. 5.5). Accepted for backwards compatibility; automatic funding makes it unnecessary.")
  })
});

export const DepositDeploymentResponseSchema = z.object({
  data: DeploymentResponseSchema
});

export const UpdateDeploymentRequestSchema = z.object({
  data: z.object({
    sdl: z.string()
  })
});

export const UpdateDeploymentResponseSchema = z.object({
  data: DeploymentResponseSchema
});

export const ListDeploymentsQuerySchema = z.object({
  skip: z.coerce.number().min(0).optional(),
  limit: z.coerce.number().min(1).default(1000).optional()
});

export const ListDeploymentsResponseSchema = z.object({
  data: z.object({
    deployments: z.array(DeploymentLeaseListItemSchema),
    pagination: z.object({
      total: z.number(),
      skip: z.number(),
      limit: z.number(),
      hasMore: z.boolean()
    })
  })
});

export const deploymentListMaxLimit = 100;

export const ListWithResourcesParamsSchema = z.object({
  address: AkashAddressSchema.openapi({
    description: "Wallet Address",
    example: openApiExampleAddress
  }),
  skip: z.coerce.number().min(0).openapi({
    description: "Deployments to skip",
    example: 10
  }),
  limit: z.coerce.number().min(1).max(deploymentListMaxLimit).openapi({
    description: "Deployments to return",
    example: 10
  })
});

export const ListWithResourcesQuerySchema = z.object({
  status: z.enum(["active", "closed"]).openapi({
    description: "Filter by status",
    example: "closed"
  }),
  reverseSorting: z
    .string()
    .optional()
    .transform(val => val === "true")
    .openapi({
      description: "Reverse sorting",
      example: "true"
    })
});

export const ListWithResourcesResponseSchema = z.object({
  count: z.number(),
  results: z.array(
    z.object({
      owner: z.string(),
      dseq: DseqSchema,
      status: z.string(),
      createdHeight: z.number(),
      cpuUnits: z.number(),
      gpuUnits: z.number(),
      memoryQuantity: z.number(),
      storageQuantity: z.number(),
      leases: z.array(
        z.object({
          id: z.string(),
          owner: z.string(),
          provider: z
            .object({
              address: z.string(),
              hostUri: z.string()
            })
            .optional(),
          dseq: DseqSchema,
          gseq: z.number(),
          oseq: z.number(),
          state: z.string(),
          price: z.object({ denom: z.string(), amount: z.string() })
        })
      )
    })
  )
});

export const GetDeploymentByOwnerDseqParamsSchema = z.object({
  owner: AkashAddressSchema.openapi({
    description: "Owner's Address",
    example: openApiExampleAddress
  }),
  dseq: DseqSchema.openapi({ description: "Deployment sequence number" })
});

export const GetDeploymentByOwnerDseqResponseSchema = z.object({
  owner: z.string(),
  dseq: DseqSchema,
  balance: z.number(),
  denom: z.string(),
  status: z.string(),
  totalMonthlyCostUDenom: z.number(),
  leases: z.array(
    z.object({
      gseq: z.number(),
      oseq: z.number(),
      provider: z
        .object({
          address: z.string(),
          hostUri: z.string(),
          isDeleted: z.boolean(),
          attributes: z.array(
            z.object({
              key: z.string(),
              value: z.string()
            })
          )
        })
        .nullable(),
      status: z.string(),
      monthlyCostUDenom: z.number(),
      cpuUnits: z.number(),
      gpuUnits: z.number(),
      memoryQuantity: z.number(),
      storageQuantity: z.number()
    })
  ),
  events: z.array(
    z.object({
      txHash: z.string(),
      date: z.date(),
      type: z.string()
    })
  ),
  other: DeploymentInfoSchema
});

export const GetWeeklyDeploymentCostResponseSchema = z.object({
  data: z.object({
    weeklyCost: z.number().describe("Total weekly cost in USD for all deployments with auto top-up enabled")
  })
});

export type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;
export type CreateLeaseResponse = z.infer<typeof CreateLeaseResponseSchema>;
export type ConsoleSettings = z.infer<typeof ConsoleSettingsSchema>;
export type GetDeploymentResponse = z.infer<typeof GetDeploymentResponseSchema>;
export type CreateDeploymentRequest = z.infer<typeof CreateDeploymentRequestSchema>;
export type CreateDeploymentResponse = z.infer<typeof CreateDeploymentResponseSchema>;
export type CloseDeploymentResponse = z.infer<typeof CloseDeploymentResponseSchema>;
export type DepositDeploymentRequest = z.infer<typeof DepositDeploymentRequestSchema>;
export type DepositDeploymentResponse = z.infer<typeof DepositDeploymentResponseSchema>;
export type UpdateDeploymentRequest = z.infer<typeof UpdateDeploymentRequestSchema>;
export type UpdateDeploymentResponse = z.infer<typeof UpdateDeploymentResponseSchema>;
export type ListWithResourcesParams = z.infer<typeof ListWithResourcesParamsSchema>;
export type ListWithResourcesQuery = z.infer<typeof ListWithResourcesQuerySchema>;
export type ListWithResourcesResponse = z.infer<typeof ListWithResourcesResponseSchema>;
export type ListDeploymentsItem = z.infer<typeof DeploymentLeaseListItemSchema>;
export type GetDeploymentByOwnerDseqResponse = z.infer<typeof GetDeploymentByOwnerDseqResponseSchema>;
export type GetWeeklyDeploymentCostResponse = z.infer<typeof GetWeeklyDeploymentCostResponseSchema>;
