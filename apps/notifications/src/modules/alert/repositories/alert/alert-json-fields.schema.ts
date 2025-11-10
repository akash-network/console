import type { ZodObject } from "zod";
import { z } from "zod";

const toCompound = <T extends { operator: any; value: any; field: any }>(schema: ZodObject<T>) =>
  z.union([
    z.object({
      operator: z.literal("and"),
      value: z.array(schema).min(2)
    }),
    z.object({
      operator: z.literal("or"),
      value: z.array(schema).min(2)
    }),
    schema
  ]);

export const generalConditionsShape = {
  operator: z.union([z.literal("eq"), z.literal("lt"), z.literal("gt"), z.literal("lte"), z.literal("gte")]),
  field: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()])
};

export const generalAlertConditionsSchema = toCompound(z.object(generalConditionsShape));

const deploymentBalanceConditionsShape = {
  operator: z.union([z.literal("eq"), z.literal("lt"), z.literal("gt"), z.literal("lte"), z.literal("gte")]),
  field: z.literal("balance"),
  value: z.number()
};

export const balanceConditionsSchema = toCompound(z.object(deploymentBalanceConditionsShape));

const dseqSchema = z.string().regex(/^\d+$/, {
  message: "Must be a numeric string"
});

export const deploymentBalanceParamsSchema = z.object({
  dseq: dseqSchema,
  owner: z.string(),
  suppressedBySystem: z.boolean().optional()
});

export const walletBalanceParamsSchema = z.object({
  owner: z.string(),
  denom: z.string(),
  suppressedBySystem: z.boolean().optional()
});

export const generalParamsSchema = z.object({
  dseq: dseqSchema,
  type: z.string(),
  suppressedBySystem: z.boolean().optional()
});

export const chainMessageTypeSchema = z.literal("CHAIN_MESSAGE");
export const chainEventTypeSchema = z.literal("CHAIN_EVENT");
export const deploymentBalanceTypeSchema = z.literal("DEPLOYMENT_BALANCE");
export const walletBalanceTypeSchema = z.literal("WALLET_BALANCE");

export const generalJsonFieldsSchema = z.object({
  type: z.union([chainMessageTypeSchema, chainEventTypeSchema]),
  params: generalParamsSchema.optional(),
  conditions: generalAlertConditionsSchema
});

export const deploymentBalanceJsonFieldsSchema = z.object({
  type: deploymentBalanceTypeSchema,
  params: deploymentBalanceParamsSchema,
  conditions: balanceConditionsSchema
});

export const walletBalanceJsonFieldsSchema = z.object({
  type: walletBalanceTypeSchema,
  params: walletBalanceParamsSchema,
  conditions: balanceConditionsSchema
});

export type GeneralJsonFields = z.infer<typeof generalJsonFieldsSchema>;
export type DeploymentBalanceJsonFields = z.infer<typeof deploymentBalanceJsonFieldsSchema>;
export type WalletBalanceJsonFields = z.infer<typeof walletBalanceJsonFieldsSchema>;
