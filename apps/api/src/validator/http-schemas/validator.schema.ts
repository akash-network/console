import { z } from "zod";

import { openApiExampleValidatorAddress } from "@src/utils/constants";
import { AkashValidatorAddressSchema } from "@src/utils/schema";

export const GetValidatorListResponseSchema = z.array(
  z.object({
    operatorAddress: z.string(),
    moniker: z.string(),
    votingPower: z.number(),
    commission: z.number(),
    identity: z.string(),
    votingPowerRatio: z.number(),
    rank: z.number(),
    keybaseAvatarUrl: z.string().nullable()
  })
);

export const GetValidatorByAddressParamsSchema = z.object({
  address: AkashValidatorAddressSchema.openapi({
    description: "Validator Address",
    example: openApiExampleValidatorAddress
  })
});

export const GetValidatorByAddressResponseSchema = z.object({
  operatorAddress: z.string(),
  address: z.string().nullable(),
  moniker: z.string(),
  keybaseUsername: z.string().nullable(),
  keybaseAvatarUrl: z.string().nullable(),
  votingPower: z.number(),
  commission: z.number(),
  maxCommission: z.number(),
  maxCommissionChange: z.number(),
  identity: z.string(),
  description: z.string(),
  website: z.string(),
  rank: z.number()
});

export type GetValidatorListResponse = z.infer<typeof GetValidatorListResponseSchema>;
export type GetValidatorByAddressParams = z.infer<typeof GetValidatorByAddressParamsSchema>;
export type GetValidatorByAddressResponse = z.infer<typeof GetValidatorByAddressResponseSchema>;
