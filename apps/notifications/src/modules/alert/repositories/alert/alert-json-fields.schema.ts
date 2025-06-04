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

export const chainMessageConditionsShape = {
  operator: z.union([z.literal("eq"), z.literal("lt"), z.literal("gt"), z.literal("lte"), z.literal("gte")]),
  field: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()])
};

export const chainMessageConditionsSchema = toCompound(z.object(chainMessageConditionsShape));

const deploymentBalanceConditionsShape = {
  operator: z.union([z.literal("eq"), z.literal("lt"), z.literal("gt"), z.literal("lte"), z.literal("gte")]),
  field: z.literal("balance"),
  value: z.number()
};

export const deploymentBalanceConditionsSchema = toCompound(z.object(deploymentBalanceConditionsShape));

const dseqSchema = z.string().regex(/^\d+$/, {
  message: "Must be a numeric string"
});

export const deploymentBalanceParamsSchema = z.object({
  dseq: dseqSchema,
  owner: z.string()
});

export const chainMessageParamsSchema = z.object({
  dseq: dseqSchema,
  type: z.string()
});

export const chainMessageTypeSchema = z.literal("CHAIN_MESSAGE");
export const deploymentBalanceTypeSchema = z.literal("DEPLOYMENT_BALANCE");

export const chainMessageJsonFieldsSchema = z.object({
  type: chainMessageTypeSchema,
  params: chainMessageParamsSchema.optional(),
  conditions: chainMessageConditionsSchema
});

export const deploymentBalanceJsonFieldsSchema = z.object({
  type: deploymentBalanceTypeSchema,
  params: deploymentBalanceParamsSchema,
  conditions: deploymentBalanceConditionsSchema
});

export type ChainMessageJsonFields = z.infer<typeof chainMessageJsonFieldsSchema>;
export type DeploymentBalanceJsonFields = z.infer<typeof deploymentBalanceJsonFieldsSchema>;
