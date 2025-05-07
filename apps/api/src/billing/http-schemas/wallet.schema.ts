import { z } from "zod";

const WalletOutputSchema = z.object({
  id: z.number().openapi({}),
  userId: z.string().openapi({}),
  creditAmount: z.number().openapi({}),
  address: z.string().openapi({}),
  isTrialing: z.boolean()
});

export const WalletResponseOutputSchema = z.object({
  data: WalletOutputSchema
});

export const WalletListResponseOutputSchema = z.object({
  data: z.array(WalletOutputSchema)
});

export const StartTrialRequestInputSchema = z.object({
  data: z.object({
    userId: z.string().openapi({})
  })
});

export type WalletOutputResponse = z.infer<typeof WalletResponseOutputSchema>;
export type WalletListOutputResponse = z.infer<typeof WalletListResponseOutputSchema>;
export type StartTrialRequestInput = z.infer<typeof StartTrialRequestInputSchema>;
