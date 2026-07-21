import { z } from "@hono/zod-openapi";

const WalletOutputSchema = z.object({
  id: z.number().nullable().openapi({}),
  userId: z.string().nullable().openapi({}),
  creditAmount: z.number().openapi({}),
  address: z.string().nullable().openapi({}),
  denom: z.string().openapi({}),
  isTrialing: z.boolean(),
  topUpMinAmountUsd: z.number().openapi({ description: "Minimum USD amount accepted by the next paid top-up for this wallet." }),
  createdAt: z.coerce.date().nullable().openapi({})
});

const WalletWithOptional3DSSchema = WalletOutputSchema.extend({
  requires3DS: z.boolean().optional(),
  clientSecret: z.string().nullable().optional(),
  paymentIntentId: z.string().nullable().optional(),
  paymentMethodId: z.string().nullable().optional()
});

export const WalletResponseOutputSchema = z.object({
  data: WalletWithOptional3DSSchema
});

export const WalletResponseNo3DSOutputSchema = z.object({
  data: WalletWithOptional3DSSchema.strict()
    .refine(data => !data.requires3DS, { message: "requires3DS must be false or undefined for 200 responses" })
    .refine(data => !data.clientSecret, { message: "clientSecret must be null or undefined for 200 responses" })
    .refine(data => !data.paymentIntentId, { message: "paymentIntentId must be null or undefined for 200 responses" })
    .refine(data => !data.paymentMethodId, { message: "paymentMethodId must be null or undefined for 200 responses" })
});

export const WalletListResponseOutputSchema = z.object({
  data: z.array(WalletWithOptional3DSSchema)
});

export const StartTrialRequestInputSchema = z.object({
  data: z.object({
    userId: z.string().openapi({})
  })
});

export const WalletSettingsSchema = z.object({
  autoReloadEnabled: z.boolean().openapi({})
});

export const WalletSettingsResponseSchema = z.object({
  data: WalletSettingsSchema
});

export const CreateWalletSettingsRequestSchema = z.object({
  data: WalletSettingsSchema
});

export const UpdateWalletSettingsRequestSchema = z.object({
  data: WalletSettingsSchema
});

export type WalletOutputResponse = z.infer<typeof WalletResponseOutputSchema>;
export type WalletListOutputResponse = z.infer<typeof WalletListResponseOutputSchema>;
export type StartTrialRequestInput = z.infer<typeof StartTrialRequestInputSchema>;
export type WalletSettingsResponse = z.infer<typeof WalletSettingsResponseSchema>;
export type CreateWalletSettingsRequest = z.infer<typeof CreateWalletSettingsRequestSchema>;
export type UpdateWalletSettingsRequest = z.infer<typeof UpdateWalletSettingsRequestSchema>;
