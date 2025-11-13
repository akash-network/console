import { z } from "zod";

import { DseqSchema } from "@src/utils/schema";

const DeploymentResource_V3 = z.object({
  cpu: z.object({
    units: z.object({
      val: z.string()
    }),
    attributes: z.array(
      z.object({
        key: z.string(),
        value: z.string()
      })
    )
  }),
  gpu: z.object({
    units: z.object({
      val: z.string()
    }),
    attributes: z.array(
      z.object({
        key: z.string(),
        value: z.string()
      })
    )
  }),
  memory: z.object({
    quantity: z.object({
      val: z.string()
    }),
    attributes: z.array(
      z.object({
        key: z.string(),
        value: z.string()
      })
    )
  }),
  storage: z.array(
    z.object({
      name: z.string(),
      quantity: z.object({
        val: z.string()
      }),
      attributes: z.array(
        z.object({
          key: z.string(),
          value: z.string()
        })
      )
    })
  ),
  endpoints: z.array(
    z.object({
      kind: z.string(),
      sequence_number: z.number()
    })
  )
});

export const BidResponseSchema = z.object({
  bid: z.object({
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
    resources_offer: z.array(
      z.object({
        resources: DeploymentResource_V3,
        count: z.number()
      })
    )
  }),
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
  }),
  isCertificateRequired: z.boolean()
});

export const ListBidsQuerySchema = z.object({
  dseq: DseqSchema
});

export const ListBidsResponseSchema = z.object({
  data: z.array(BidResponseSchema)
});

export type ListBidsResponse = z.infer<typeof ListBidsResponseSchema>;
