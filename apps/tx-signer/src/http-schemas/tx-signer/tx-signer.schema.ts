import { z } from "zod";

const EncodedMessageSchema = z.object({
  typeUrl: z.string(),
  value: z.string()
});

export const SignAndBroadcastFundingRequestInputSchema = z.object({
  data: z.object({
    messages: z.array(EncodedMessageSchema).min(1)
  })
});

export const SignAndBroadcastDerivedRequestInputSchema = z.object({
  data: z.object({
    derivationIndex: z.number(),
    messages: z.array(EncodedMessageSchema).min(1),
    options: z
      .object({
        fee: z.object({
          granter: z.string()
        })
      })
      .optional()
  })
});

export const SignAndBroadcastResponseOutputSchema = z.object({
  data: z
    .object({
      code: z.number(),
      hash: z.string(),
      rawLog: z.string()
    })
    .passthrough()
});

export type SignAndBroadcastFundingRequestInput = z.infer<typeof SignAndBroadcastFundingRequestInputSchema>;
export type SignAndBroadcastDerivedRequestInput = z.infer<typeof SignAndBroadcastDerivedRequestInputSchema>;
export type SignAndBroadcastResponseOutput = z.infer<typeof SignAndBroadcastResponseOutputSchema>;
