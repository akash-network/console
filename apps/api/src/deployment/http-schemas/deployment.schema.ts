import { z } from "zod";

import { SignTxResponseOutputSchema } from "@src/billing/routes/sign-and-broadcast-tx/sign-and-broadcast-tx.router";
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

export const GetDeploymentQuerySchema = z.object({
  dseq: z.string(),
  userId: z.optional(z.string())
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

export type GetDeploymentResponse = z.infer<typeof GetDeploymentResponseSchema>;
export type CreateDeploymentRequest = z.infer<typeof CreateDeploymentRequestSchema>;
export type CreateDeploymentResponse = z.infer<typeof CreateDeploymentResponseSchema>;
export type CloseDeploymentParams = z.infer<typeof CloseDeploymentParamsSchema>;
export type CloseDeploymentResponse = z.infer<typeof CloseDeploymentResponseSchema>;
export type DepositDeploymentRequest = z.infer<typeof DepositDeploymentRequestSchema>;
export type DepositDeploymentResponse = z.infer<typeof DepositDeploymentResponseSchema>;
export type UpdateDeploymentRequest = z.infer<typeof UpdateDeploymentRequestSchema>;
export type UpdateDeploymentResponse = z.infer<typeof UpdateDeploymentResponseSchema>;
