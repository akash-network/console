import { z } from "zod";

import { DEFAULT_SEED_VERSION, SeedVersionSchema } from "@src/lib/seed-version/seed-version";

/** From 2^31 up an index derives a hardened key, which is another wallet than the one a user account at that index has. */
const MAX_DERIVATION_INDEX = 2 ** 31 - 1;

export const FundingWalletAddressesResponseSchema = z.object({
  data: z.object({
    addresses: z.array(z.string())
  })
});

export const DerivedWalletAddressParamsSchema = z.object({
  index: z.coerce.number().int().nonnegative().max(MAX_DERIVATION_INDEX)
});

export const DerivedWalletAddressQuerySchema = z.object({
  version: SeedVersionSchema.default(DEFAULT_SEED_VERSION)
});

export const DerivedWalletAddressResponseSchema = z.object({
  data: z.object({
    address: z.string()
  })
});

export const IssueProviderTokenRequestInputSchema = z.object({
  data: z.object({
    derivationIndex: z.number().int().nonnegative().max(MAX_DERIVATION_INDEX),
    seedVersion: SeedVersionSchema.optional(),
    leases: z.object({ access: z.enum(["full", "scoped", "granular"]) }).passthrough(),
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
