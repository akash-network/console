import { z } from "zod";

import { openApiExampleProviderAddress } from "@src/utils/constants";
import { AkashAddressSchema } from "@src/utils/schema";

export const ProviderListQuerySchema = z.object({
  scope: z.enum(["all", "trial"]).default("all")
});
export const ProviderListResponseSchema = z.array(
  z.object({
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
  })
);

const statsItemSchema = z.object({
  active: z.number(),
  available: z.number(),
  pending: z.number()
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
  stats: z.object({
    cpu: statsItemSchema,
    gpu: statsItemSchema,
    memory: statsItemSchema,
    storage: z.object({
      ephemeral: statsItemSchema,
      persistent: statsItemSchema
    })
  }),
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
export type ProviderParams = z.infer<typeof ProviderParamsSchema>;
export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;
export type ProviderActiveLeasesGraphDataParams = z.infer<typeof ProviderActiveLeasesGraphDataParamsSchema>;
export type ProviderActiveLeasesGraphDataResponse = z.infer<typeof ProviderActiveLeasesGraphDataResponseSchema>;
