import { z } from "@hono/zod-openapi";

import { STANDARD_TOP_UP_MIN_AMOUNT_USD } from "@src/billing/config";

const AUTO_RELOAD_THRESHOLD_MIN_USD = 5;

/** Upper bounds stop an oversized value from being charged verbatim to the card. */
const AUTO_RELOAD_THRESHOLD_MAX_USD = 10_000;
const AUTO_RELOAD_AMOUNT_MAX_USD = 10_000;

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

export const WalletListResponseOutputSchema = z.object({
  data: z.array(WalletWithOptional3DSSchema)
});

export const WalletSettingsOutputSchema = z.object({
  autoReloadEnabled: z.boolean().openapi({}),
  autoReloadThreshold: z.number().openapi({ description: "USD credit balance at or below which an automatic top-up is triggered." }),
  autoReloadAmount: z.number().openapi({ description: "USD amount charged to the default payment method on each automatic top-up." })
});

export const WalletSettingsInputSchema = z.object({
  autoReloadEnabled: z.boolean().openapi({}),
  autoReloadThreshold: z
    .number()
    .min(AUTO_RELOAD_THRESHOLD_MIN_USD)
    .max(AUTO_RELOAD_THRESHOLD_MAX_USD)
    .multipleOf(0.01)
    .optional()
    .openapi({
      description: `USD credit balance at or below which an automatic top-up is triggered (minimum ${AUTO_RELOAD_THRESHOLD_MIN_USD}, maximum ${AUTO_RELOAD_THRESHOLD_MAX_USD}). Defaults are applied on create when omitted.`
    }),
  autoReloadAmount: z
    .number()
    .min(STANDARD_TOP_UP_MIN_AMOUNT_USD)
    .max(AUTO_RELOAD_AMOUNT_MAX_USD)
    .multipleOf(0.01)
    .optional()
    .openapi({
      description: `USD amount charged on each automatic top-up (minimum ${STANDARD_TOP_UP_MIN_AMOUNT_USD}, maximum ${AUTO_RELOAD_AMOUNT_MAX_USD}). Defaults are applied on create when omitted.`
    })
});

export const WalletSettingsResponseSchema = z.object({
  data: WalletSettingsOutputSchema
});

export const CreateWalletSettingsRequestSchema = z.object({
  data: WalletSettingsInputSchema
});

export const UpdateWalletSettingsRequestSchema = z.object({
  data: WalletSettingsInputSchema
});

export type WalletListOutputResponse = z.infer<typeof WalletListResponseOutputSchema>;
export type WalletSettingsResponse = z.infer<typeof WalletSettingsResponseSchema>;
export type CreateWalletSettingsRequest = z.infer<typeof CreateWalletSettingsRequestSchema>;
export type UpdateWalletSettingsRequest = z.infer<typeof UpdateWalletSettingsRequestSchema>;
