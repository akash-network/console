import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { toPaginatedResponse } from "@src/lib/http-schema/http-schema";
import {
  balanceConditionsSchema,
  chainEventTypeSchema,
  chainMessageTypeSchema,
  deploymentBalanceParamsSchema,
  deploymentBalanceTypeSchema,
  generalAlertConditionsSchema,
  generalParamsSchema,
  walletBalanceParamsSchema,
  walletBalanceTypeSchema
} from "@src/modules/alert/repositories/alert/alert-json-fields.schema";

export const alertCreateCommonInputSchema = z.object({
  notificationChannelId: z.string().uuid(),
  name: z.string().min(3),
  enabled: z.boolean().optional().default(true),
  summary: z.string().min(3),
  description: z.string().min(3)
});

export const generalAlertCreateInputSchema = alertCreateCommonInputSchema
  .extend({
    params: generalParamsSchema.optional(),
    conditions: generalAlertConditionsSchema
  })
  .strict();

export const chainMessageCreateInputSchema = generalAlertCreateInputSchema
  .extend({
    type: chainMessageTypeSchema
  })
  .strict();

export const chainEventCreateInputSchema = generalAlertCreateInputSchema
  .extend({
    type: chainEventTypeSchema
  })
  .strict();

export const deploymentBalanceCreateInputSchema = alertCreateCommonInputSchema
  .extend({
    type: deploymentBalanceTypeSchema,
    conditions: balanceConditionsSchema,
    params: deploymentBalanceParamsSchema
  })
  .strict();

export const walletBalanceCreateInputSchema = alertCreateCommonInputSchema
  .extend({
    type: walletBalanceTypeSchema,
    conditions: balanceConditionsSchema,
    params: walletBalanceParamsSchema
  })
  .strict();

export const alertCreateInputSchema = z.discriminatedUnion("type", [
  chainMessageCreateInputSchema,
  chainEventCreateInputSchema,
  deploymentBalanceCreateInputSchema,
  walletBalanceCreateInputSchema
]);

export class AlertCreateInput extends createZodDto(z.object({ data: alertCreateInputSchema })) {}

export const alertPatchInputSchema = alertCreateCommonInputSchema
  .extend({
    conditions: z.union([generalAlertConditionsSchema, balanceConditionsSchema])
  })
  .partial();

export class AlertPatchInput extends createZodDto(z.object({ data: alertPatchInputSchema })) {}

export const alertCommonOutputSchema = alertCreateCommonInputSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  enabled: z.boolean(),
  notificationChannelName: z.string().optional(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const generalAlertOutputSchema = alertCommonOutputSchema.extend({
  params: generalParamsSchema.optional(),
  conditions: generalAlertConditionsSchema
});

export const chainMessageOutputSchema = generalAlertOutputSchema.extend({
  type: chainMessageTypeSchema
});

export const chainEventOutputSchema = generalAlertOutputSchema.extend({
  type: chainEventTypeSchema
});

export const deploymentBalanceOutputSchema = alertCommonOutputSchema.extend({
  type: deploymentBalanceTypeSchema,
  conditions: balanceConditionsSchema,
  params: deploymentBalanceParamsSchema
});

export const walletBalanceOutputSchema = alertCommonOutputSchema.extend({
  type: walletBalanceTypeSchema,
  conditions: balanceConditionsSchema,
  params: walletBalanceParamsSchema
});

export const alertOutputSchema = z.discriminatedUnion("type", [
  chainMessageOutputSchema,
  chainEventOutputSchema,
  deploymentBalanceOutputSchema,
  walletBalanceOutputSchema
]);

export const alertOutputResponseSchema = z.object({ data: alertOutputSchema });
export class AlertOutputResponse extends createZodDto(alertOutputResponseSchema) {}

export class AlertListOutputResponse extends createZodDto(toPaginatedResponse(alertOutputSchema)) {}
