import { z } from "zod";

const WalletOutputSchema = z.object({
  id: z.number().nullable().openapi({}),
  userId: z.string().nullable().openapi({}),
  creditAmount: z.number().openapi({}),
  address: z.string().nullable().openapi({}),
  isTrialing: z.boolean(),
  createdAt: z.coerce.date().nullable().openapi({})
});

const ThreeDSecureAuthSchema = z.object({
  requires3DS: z.boolean(),
  clientSecret: z.string(),
  paymentIntentId: z.string(),
  paymentMethodId: z.string()
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

export const WalletResponse3DSOutputSchema = z.object({
  data: WalletWithOptional3DSSchema.strict()
    .refine(data => data.requires3DS === true, { message: "requires3DS must be true for 202 responses" })
    .refine(data => data.clientSecret !== null && data.clientSecret !== undefined, { message: "clientSecret is required for 202 responses" })
    .refine(data => data.paymentIntentId !== null && data.paymentIntentId !== undefined, { message: "paymentIntentId is required for 202 responses" })
    .refine(data => data.paymentMethodId !== null && data.paymentMethodId !== undefined, { message: "paymentMethodId is required for 202 responses" })
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
  autoReloadEnabled: z.boolean().openapi({}),
  autoReloadThreshold: z.number().min(20).optional().openapi({}),
  autoReloadAmount: z.number().min(20).optional().openapi({})
});

export const WalletSettingsResponseSchema = z.object({
  data: WalletSettingsSchema
});

export const CreateWalletSettingsRequestSchema = z.object({
  data: WalletSettingsSchema
});

export const UpdateWalletSettingsRequestSchema = z.object({
  data: WalletSettingsSchema.partial()
});

export type WalletOutput = z.infer<typeof WalletOutputSchema>;
export type ThreeDSecureAuth = z.infer<typeof ThreeDSecureAuthSchema>;
export type WalletWithOptional3DS = z.infer<typeof WalletWithOptional3DSSchema>;
export type WalletOutputResponse = z.infer<typeof WalletResponseOutputSchema>;
export type WalletResponseNo3DSOutput = z.infer<typeof WalletResponseNo3DSOutputSchema>;
export type WalletResponse3DSOutput = z.infer<typeof WalletResponse3DSOutputSchema>;
export type WalletListOutputResponse = z.infer<typeof WalletListResponseOutputSchema>;
export type StartTrialRequestInput = z.infer<typeof StartTrialRequestInputSchema>;
export type WalletSettingsResponse = z.infer<typeof WalletSettingsResponseSchema>;
export type CreateWalletSettingsRequest = z.infer<typeof CreateWalletSettingsRequestSchema>;
export type UpdateWalletSettingsRequest = z.infer<typeof UpdateWalletSettingsRequestSchema>;
