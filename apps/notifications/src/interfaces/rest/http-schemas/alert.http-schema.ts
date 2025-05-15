import { z } from "zod";

import {
  chainMessageConditionsSchema,
  chainMessageTypeSchema,
  deploymentBalanceConditionsSchema,
  deploymentBalanceParamsSchema,
  deploymentBalanceTypeSchema
} from "@src/modules/alert/repositories/alert/alert-json-fields.schema";

export const alertCreateCommonInputSchema = z.object({
  // TODO: receive user from the auth instead
  userId: z.string().uuid(),
  contactPointId: z.string().uuid(),
  enabled: z.boolean().optional().default(true),
  summary: z.string().min(3),
  description: z.string().min(3)
});

export const chainMessageCreateInputSchema = alertCreateCommonInputSchema
  .extend({
    type: chainMessageTypeSchema,
    conditions: chainMessageConditionsSchema
  })
  .strict();

export const deploymentBalanceCreateInputSchema = alertCreateCommonInputSchema
  .extend({
    type: deploymentBalanceTypeSchema,
    conditions: deploymentBalanceConditionsSchema,
    params: deploymentBalanceParamsSchema
  })
  .strict();

export const alertCreateInputSchema = z.discriminatedUnion("type", [chainMessageCreateInputSchema, deploymentBalanceCreateInputSchema]);

export const alertPatchInputSchema = alertCreateCommonInputSchema
  .extend({
    conditions: z.union([chainMessageConditionsSchema, deploymentBalanceConditionsSchema])
  })
  .partial();

export const alertCommonOutputSchema = alertCreateCommonInputSchema.extend({
  id: z.string().uuid(),
  enabled: z.boolean(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const chainMessageOutputSchema = alertCommonOutputSchema.extend({
  type: chainMessageTypeSchema,
  conditions: chainMessageConditionsSchema
});

export const deploymentBalanceOutputSchema = alertCommonOutputSchema.extend({
  type: deploymentBalanceTypeSchema,
  conditions: deploymentBalanceConditionsSchema,
  params: deploymentBalanceParamsSchema
});

export const alertOutputSchema = z.discriminatedUnion("type", [chainMessageOutputSchema, deploymentBalanceOutputSchema]);

export const alertOutputResponseSchema = z.object({ data: alertOutputSchema });
export type AlertOutputResponse = z.infer<typeof alertOutputResponseSchema>;
