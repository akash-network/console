import { z } from "zod";

import { DERIVED_WALLET_MESSAGE_TYPE_URLS, FUNDING_WALLET_MESSAGE_TYPE_URLS } from "@src/config/message-urls.config";

export const SignAndBroadcastFundingRequestInputSchema = z.object({
  data: z.object({
    messages: z
      .array(
        z.object({
          typeUrl: z.enum(FUNDING_WALLET_MESSAGE_TYPE_URLS),
          value: z.string()
        })
      )
      .min(1)
  })
});

export const SignAndBroadcastDerivedRequestInputSchema = z.object({
  data: z.object({
    derivationIndex: z.number().int().nonnegative(),
    messages: z
      .array(
        z.object({
          typeUrl: z.enum(DERIVED_WALLET_MESSAGE_TYPE_URLS),
          value: z.string()
        })
      )
      .min(1),
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
