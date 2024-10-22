import { z } from "zod";

// TODO: Extract into a types package
const BidOutputSchema = z.object({
  bid_id: z.object({
    owner: z.string().openapi({}),
    dseq: z.string().openapi({}),
    gseq: z.number().openapi({}),
    oseq: z.number().openapi({}),
    provider: z.string().openapi({})
  }),
  state: z.string().openapi({}),
  price: z.object({
    denom: z.string().openapi({}),
    amount: z.string().openapi({})
  }),
  created_at: z.string().openapi({}),
  resources_offer: z.array(
    z.object({
      resources: z.object({
        id: z.number().openapi({})
      })
    })
  )
});

export const BidListResponseOutputSchema = z.object({
  bids: z.array(BidOutputSchema)
});
export type BidListOutputResponse = z.infer<typeof BidListResponseOutputSchema>;
