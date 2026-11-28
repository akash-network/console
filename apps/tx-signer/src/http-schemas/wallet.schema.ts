import { z } from "zod";

export const FundingWalletAddressesResponseSchema = z.object({
  data: z.object({
    addresses: z.array(z.string())
  })
});

export const DerivedWalletAddressParamsSchema = z.object({
  index: z.coerce.number().int().nonnegative()
});

export const DerivedWalletAddressQuerySchema = z.object({
  version: z.enum(["v1", "v2"]).default("v2")
});

export const DerivedWalletAddressResponseSchema = z.object({
  data: z.object({
    address: z.string()
  })
});

export const IssueProviderTokenRequestInputSchema = z.object({
  data: z.object({
    derivationIndex: z.number().int().nonnegative(),
    leases: z.object({ access: z.enum(["full", "granular"]) }).passthrough(),
    ttl: z.number().int().positive()
  })
});

export const IssueProviderTokenResponseSchema = z.object({
  data: z.object({
    token: z.string()
  })
});

export type FundingWalletAddressesResponse = z.infer<typeof FundingWalletAddressesResponseSchema>;
export type DerivedWalletAddressResponse = z.infer<typeof DerivedWalletAddressResponseSchema>;
export type IssueProviderTokenRequestInput = z.infer<typeof IssueProviderTokenRequestInputSchema>;
export type IssueProviderTokenResponse = z.infer<typeof IssueProviderTokenResponseSchema>;
