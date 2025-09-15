import { z } from "zod";

const WalletOutputSchema = z.object({
  id: z.number().openapi({}),
  userId: z.string().nullable().openapi({}),
  creditAmount: z.number().openapi({}),
  address: z.string().nullable().openapi({}),
  isTrialing: z.boolean()
});

const ThreeDSecureAuthSchema = z.object({
  requires3DS: z.boolean(),
  clientSecret: z.string(),
  paymentIntentId: z.string(),
  paymentMethodId: z.string()
});

const WalletWithOptional3DSSchema = WalletOutputSchema.extend({
  requires3DS: z.boolean().optional(),
  clientSecret: z.string().optional(),
  paymentIntentId: z.string().optional(),
  paymentMethodId: z.string().optional()
});

export const WalletResponseOutputSchema = z.object({
  data: WalletWithOptional3DSSchema
});

export const WalletListResponseOutputSchema = z.object({
  data: z.array(WalletWithOptional3DSSchema)
});

export const StartTrialRequestInputSchema = z.object({
  data: z.object({
    userId: z.string().openapi({})
  })
});

export type WalletOutput = z.infer<typeof WalletOutputSchema>;
export type ThreeDSecureAuth = z.infer<typeof ThreeDSecureAuthSchema>;
export type WalletWithOptional3DS = z.infer<typeof WalletWithOptional3DSSchema>;
export type WalletOutputResponse = z.infer<typeof WalletResponseOutputSchema>;
export type WalletListOutputResponse = z.infer<typeof WalletListResponseOutputSchema>;
export type StartTrialRequestInput = z.infer<typeof StartTrialRequestInputSchema>;
