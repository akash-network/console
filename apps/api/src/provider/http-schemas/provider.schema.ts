import { z } from "@hono/zod-openapi";

import { openApiExampleProviderAddress } from "@src/utils/constants";
import { AkashAddressSchema } from "@src/utils/schema";

const MAX_ADDRESSES = 20;

const AddressesSchema = z
  .string()
  .transform(val =>
    val
      .split(",")
      .map(a => a.trim())
      .filter(Boolean)
  )
  .pipe(z.array(z.string().min(1)).min(1).max(MAX_ADDRESSES));

export const ProviderListQuerySchema = z.object({
  scope: z.enum(["all", "trial"]).default("all"),
  addresses: AddressesSchema.optional()
});

const statsItemSchema = z.object({
  active: z.number(),
  available: z.number(),
  pending: z.number()
});

const ProviderStatsSchema = z.object({
  cpu: statsItemSchema,
  gpu: statsItemSchema,
  memory: statsItemSchema,
  storage: z.object({
    ephemeral: statsItemSchema,
    persistent: statsItemSchema
  })
});

const ProviderListItemSchema = z.object({
  owner: z.string(),
  name: z.string().nullable(),
  hostUri: z.string(),
  createdHeight: z.number(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  lastCheckDate: z.string().nullable().optional(),
  deploymentCount: z.number().nullable().optional(),
  leaseCount: z.number().nullable().optional(),
  cosmosSdkVersion: z.string(),
  akashVersion: z.string(),
  ipRegion: z.string().nullable(),
  ipRegionCode: z.string().nullable(),
  ipCountry: z.string().nullable(),
  ipCountryCode: z.string().nullable(),
  ipLat: z.string().nullable(),
  ipLon: z.string().nullable(),
  uptime1d: z.number().nullable(),
  uptime7d: z.number().nullable(),
  uptime30d: z.number().nullable(),
  isValidVersion: z.boolean(),
  isOnline: z.boolean(),
  lastOnlineDate: z.string().nullable(),
  isAudited: z.boolean(),
  stats: ProviderStatsSchema,
  gpuModels: z.array(
    z.object({
      vendor: z.string(),
      model: z.string(),
      ram: z.string(),
      interface: z.string()
    })
  ),
  attributes: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      auditedBy: z.array(z.string())
    })
  ),
  host: z.string().nullable(),
  organization: z.string().nullable(),
  statusPage: z.string().nullable(),
  locationRegion: z.string().nullable(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  timezone: z.string().nullable(),
  locationType: z.string().nullable(),
  hostingProvider: z.string().nullable(),
  hardwareCpu: z.string().nullable(),
  hardwareCpuArch: z.string().nullable(),
  hardwareGpuVendor: z.string().nullable(),
  hardwareGpuModels: z.array(z.string()).nullable(),
  hardwareDisk: z.array(z.string()).nullable(),
  featPersistentStorage: z.boolean(),
  featPersistentStorageType: z.array(z.string()).nullable(),
  hardwareMemory: z.string().nullable(),
  networkProvider: z.string().nullable(),
  networkSpeedDown: z.number(),
  networkSpeedUp: z.number(),
  tier: z.string().nullable(),
  featEndpointCustomDomain: z.boolean(),
  workloadSupportChia: z.boolean(),
  workloadSupportChiaCapabilities: z.array(z.string()).nullable(),
  featEndpointIp: z.boolean()
});

export const ProviderListResponseSchema = z.array(ProviderListItemSchema);

export const PROVIDER_SEARCH_MAX_LIMIT = 100;
/** Holds a long favorites list while keeping the query string well under common URL length limits. */
export const PROVIDER_SEARCH_MAX_ADDRESSES = 100;
const PROVIDER_SEARCH_MAX_SEARCH_LENGTH = 200;

export const ProviderSearchSortSchema = z.enum(["active-leases-desc", "active-leases-asc", "wallet-leases-desc", "wallet-active-leases-desc", "gpus-desc"]);
export type ProviderSearchSort = z.infer<typeof ProviderSearchSortSchema>;

export const WALLET_LEASE_SORTS: readonly ProviderSearchSort[] = ["wallet-leases-desc", "wallet-active-leases-desc"];

const BooleanFilterSchema = z.enum(["true", "false"]).transform(value => value === "true");

export const ProviderSearchQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(PROVIDER_SEARCH_MAX_SEARCH_LENGTH)
      .optional()
      .transform(value => value || undefined)
      .openapi({ description: "Case-insensitive substring matched against each provider's host URI and address." }),
    online: BooleanFilterSchema.optional().openapi({
      description: "Only online providers when true, only offline ones when false, both when omitted."
    }),
    audited: BooleanFilterSchema.optional().openapi({
      description: "Only audited providers when true, only unaudited ones when false, both when omitted."
    }),
    addresses: z
      .string()
      .transform(value =>
        value
          .split(",")
          .map(address => address.trim())
          .filter(Boolean)
      )
      .pipe(z.array(z.string()).min(1).max(PROVIDER_SEARCH_MAX_ADDRESSES))
      .optional()
      .openapi({ description: `Comma-separated provider addresses the search is limited to, at most ${PROVIDER_SEARCH_MAX_ADDRESSES}.` }),
    sort: ProviderSearchSortSchema.default("active-leases-desc").openapi({
      description:
        "`active-leases-*` orders by the provider's active lease count, `wallet-leases-desc` and `wallet-active-leases-desc` by how many leases `walletAddress` holds on it, and `gpus-desc` by its GPU count across available, pending and active ones."
    }),
    walletAddress: AkashAddressSchema.optional().openapi({
      description: "The wallet whose leases the `wallet-leases-desc` and `wallet-active-leases-desc` sorts count. Required by those sorts."
    }),
    skip: z.coerce.number().int().min(0).default(0).openapi({ description: "Matching providers to skip before the page begins." }),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PROVIDER_SEARCH_MAX_LIMIT)
      .default(PROVIDER_SEARCH_MAX_LIMIT)
      .openapi({ description: `Providers per page, at most ${PROVIDER_SEARCH_MAX_LIMIT}.` })
  })
  .refine(query => !WALLET_LEASE_SORTS.includes(query.sort) || !!query.walletAddress, {
    message: "Sorting by a wallet's leases needs walletAddress",
    path: ["walletAddress"]
  });

export const ProviderSearchResponseSchema = z.object({
  data: z.object({
    providers: z.array(ProviderListItemSchema),
    pagination: z.object({
      total: z.number().openapi({ description: "Providers matching the filters." }),
      skip: z.number(),
      limit: z.number(),
      hasMore: z.boolean().openapi({ description: "Whether a further page exists." })
    })
  })
});

export const ProviderLocationsResponseSchema = z.object({
  data: z.array(
    z.object({
      owner: z.string(),
      name: z.string().nullable(),
      hostUri: z.string(),
      ipRegion: z.string().nullable(),
      ipCountryCode: z.string().nullable(),
      ipLat: z.string().nullable(),
      ipLon: z.string().nullable()
    })
  )
});

export const ProviderParamsSchema = z.object({
  address: z.string().openapi({
    description: "Provider Address",
    example: openApiExampleProviderAddress
  })
});

export const ProviderResponseSchema = z.object({
  owner: z.string(),
  name: z.string().nullable(),
  hostUri: z.string(),
  createdHeight: z.number(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  lastCheckDate: z.string().nullable(),
  deploymentCount: z.number(),
  leaseCount: z.number(),
  cosmosSdkVersion: z.string(),
  akashVersion: z.string(),
  ipRegion: z.string().nullable(),
  ipRegionCode: z.string().nullable(),
  ipCountry: z.string().nullable(),
  ipCountryCode: z.string().nullable(),
  ipLat: z.string().nullable(),
  ipLon: z.string().nullable(),
  uptime1d: z.number(),
  uptime7d: z.number(),
  uptime30d: z.number(),
  isValidVersion: z.boolean(),
  isOnline: z.boolean(),
  lastOnlineDate: z.string().nullable(),
  isAudited: z.boolean(),
  stats: ProviderStatsSchema,
  gpuModels: z.array(
    z.object({
      vendor: z.string(),
      model: z.string(),
      ram: z.string(),
      interface: z.string()
    })
  ),
  attributes: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      auditedBy: z.array(z.string())
    })
  ),
  host: z.string().nullable(),
  organization: z.string().nullable(),
  statusPage: z.string().nullable(),
  locationRegion: z.string().nullable(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  timezone: z.string().nullable(),
  locationType: z.string().nullable(),
  hostingProvider: z.string().nullable(),
  hardwareCpu: z.string().nullable(),
  hardwareCpuArch: z.string().nullable(),
  reportedCpuArchs: z.array(z.string()).openapi({
    description:
      "Distinct CPU architectures the provider's nodes reported in its last successful snapshot. Known spellings such as x86_64 or aarch64 are folded onto amd64 or arm64; any other reported value is kept as reported. Empty when no node reports one.",
    example: ["arm64"]
  }),
  cpuArchAgreement: z.enum(["match", "mismatch", "unknown"]).openapi({
    description:
      "Whether the self-declared capabilities/cpu/arch attribute agrees with the architecture the nodes report. Unknown when either side is missing or the declared value is not a recognised architecture."
  }),
  hardwareGpuVendor: z.string().nullable(),
  hardwareGpuModels: z.array(z.string()),
  hardwareDisk: z.array(z.string()),
  featPersistentStorage: z.boolean(),
  featPersistentStorageType: z.array(z.string()),
  hardwareMemory: z.string().nullable(),
  networkProvider: z.string().nullable(),
  networkSpeedDown: z.number(),
  networkSpeedUp: z.number(),
  tier: z.string().nullable(),
  featEndpointCustomDomain: z.boolean(),
  workloadSupportChia: z.boolean(),
  workloadSupportChiaCapabilities: z.array(z.string()),
  featEndpointIp: z.boolean(),
  uptime: z.array(
    z.object({
      id: z.string(),
      isOnline: z.boolean(),
      checkDate: z.string()
    })
  )
});

export const ProviderActiveLeasesGraphDataParamsSchema = z.object({
  providerAddress: AkashAddressSchema.openapi({ example: openApiExampleProviderAddress })
});

export const ProviderActiveLeasesGraphDataResponseSchema = z.object({
  currentValue: z.number(),
  compareValue: z.number(),
  snapshots: z.array(
    z.object({
      date: z.string().openapi({ example: "2021-07-01T00:00:00.000Z" }),
      value: z.number().openapi({ example: 100 })
    })
  ),
  now: z.object({
    count: z.number().openapi({ example: 100 })
  }),
  compare: z.object({
    count: z.number().openapi({ example: 100 })
  })
});

export type ProviderListQuery = z.infer<typeof ProviderListQuerySchema>;
export type ProviderListResponse = z.infer<typeof ProviderListResponseSchema>;
export type ProviderSearchQuery = z.infer<typeof ProviderSearchQuerySchema>;
export type ProviderSearchResponse = z.infer<typeof ProviderSearchResponseSchema>;
export type ProviderLocationsResponse = z.infer<typeof ProviderLocationsResponseSchema>;
export type ProviderParams = z.infer<typeof ProviderParamsSchema>;
export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;
export type ProviderActiveLeasesGraphDataParams = z.infer<typeof ProviderActiveLeasesGraphDataParamsSchema>;
export type ProviderActiveLeasesGraphDataResponse = z.infer<typeof ProviderActiveLeasesGraphDataResponseSchema>;
