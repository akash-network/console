import { z } from "zod";

import { SignTxResponseOutputSchema } from "@src/billing/http-schemas/tx.schema";
import { isValidBech32Address } from "@src/utils/addresses";
import { openApiExampleAddress } from "@src/utils/constants";
import { LeaseStatusResponseSchema } from "./lease.schema";

export const DeploymentResponseSchema = z.object({
  deployment: z.object({
    deployment_id: z.object({
      owner: z.string(),
      dseq: z.string()
    }),
    state: z.string(),
    version: z.string(),
    created_at: z.string()
  }),
  leases: z.array(
    z.object({
      lease_id: z.object({
        owner: z.string(),
        dseq: z.string(),
        gseq: z.number(),
        oseq: z.number(),
        provider: z.string()
      }),
      state: z.string(),
      price: z.object({
        denom: z.string(),
        amount: z.string()
      }),
      created_at: z.string(),
      closed_on: z.string(),
      status: z.nullable(LeaseStatusResponseSchema)
    })
  ),
  escrow_account: z.object({
    id: z.object({
      scope: z.string(),
      xid: z.string()
    }),
    owner: z.string(),
    state: z.string(),
    balance: z.object({
      denom: z.string(),
      amount: z.string()
    }),
    transferred: z.object({
      denom: z.string(),
      amount: z.string()
    }),
    settled_at: z.string(),
    depositor: z.string(),
    funds: z.object({
      denom: z.string(),
      amount: z.string()
    })
  })
});

export const GetDeploymentResponseSchema = z.object({
  data: DeploymentResponseSchema
});

export const CreateDeploymentRequestSchema = z.object({
  data: z.object({
    sdl: z.string(),
    deposit: z.number().describe("Amount to deposit in dollars (e.g. 5.5)")
  })
});

export const CreateDeploymentResponseSchema = z.object({
  data: z.object({
    dseq: z.string(),
    manifest: z.string(),
    signTx: SignTxResponseOutputSchema.shape.data
  })
});

export const CloseDeploymentParamsSchema = z.object({
  dseq: z.string().describe("Deployment sequence number")
});

export const CloseDeploymentResponseSchema = z.object({
  data: z.object({
    success: z.boolean()
  })
});

export const DepositDeploymentRequestSchema = z.object({
  data: z.object({
    dseq: z.string().describe("Deployment sequence number"),
    deposit: z.number().describe("Amount to deposit in dollars (e.g. 5.5)")
  })
});

export const DepositDeploymentResponseSchema = z.object({
  data: DeploymentResponseSchema
});

export const UpdateDeploymentRequestSchema = z.object({
  data: z.object({
    sdl: z.string(),
    certificate: z.object({
      certPem: z.string(),
      keyPem: z.string()
    })
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
    deployments: z.array(DeploymentResponseSchema),
    pagination: z.object({
      total: z.number(),
      skip: z.number(),
      limit: z.number(),
      hasMore: z.boolean()
    })
  })
});

export const listByOwnerMaxLimit = 100;

export const ListByOwnerParamsSchema = z.object({
  address: z
    .string()
    .refine(val => isValidBech32Address(val, "akash"), { message: "Invalid address" })
    .openapi({
      description: "Wallet Address",
      example: openApiExampleAddress
    }),
  skip: z.coerce.number().min(0).openapi({
    description: "Deployments to skip",
    example: 10
  }),
  limit: z.coerce.number().min(1).max(listByOwnerMaxLimit).openapi({
    description: "Deployments to return",
    example: 10
  })
});

export const ListByOwnerQuerySchema = z.object({
  status: z.enum(["active", "closed"]).optional().openapi({
    description: "Filter by status",
    example: "closed"
  }),
  reverseSorting: z.string().optional().openapi({
    description: "Reverse sorting",
    example: "true"
  })
});

export const ListByOwnerResponseSchema = z.object({
  count: z.number(),
  results: z.array(
    z.object({
      owner: z.string(),
      dseq: z.string(),
      status: z.string(),
      createdHeight: z.number(),
      cpuUnits: z.number(),
      gpuUnits: z.number(),
      memoryQuantity: z.number(),
      storageQuantity: z.number()
    })
  )
});

export type GetDeploymentResponse = z.infer<typeof GetDeploymentResponseSchema>;
export type CreateDeploymentRequest = z.infer<typeof CreateDeploymentRequestSchema>;
export type CreateDeploymentResponse = z.infer<typeof CreateDeploymentResponseSchema>;
export type CloseDeploymentParams = z.infer<typeof CloseDeploymentParamsSchema>;
export type CloseDeploymentResponse = z.infer<typeof CloseDeploymentResponseSchema>;
export type DepositDeploymentRequest = z.infer<typeof DepositDeploymentRequestSchema>;
export type DepositDeploymentResponse = z.infer<typeof DepositDeploymentResponseSchema>;
export type UpdateDeploymentRequest = z.infer<typeof UpdateDeploymentRequestSchema>;
export type UpdateDeploymentResponse = z.infer<typeof UpdateDeploymentResponseSchema>;
