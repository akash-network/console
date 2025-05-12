import { z } from "zod";

import { openApiExampleProviderAddress } from "@src/utils/constants";
import { AkashAddressSchema } from "@src/utils/schema";

export const ProviderListQuerySchema = z.object({
  scope: z.enum(["all", "trial"]).default("all")
});
export const ProviderListResponseSchema = z.array(
  z.object({
    owner: z.string(),
    name: z.string(),
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
    activeStats: z.object({
      cpu: z.number(),
      gpu: z.number(),
      memory: z.number(),
      storage: z.number()
    }),
    pendingStats: z.object({
      cpu: z.number(),
      gpu: z.number(),
      memory: z.number(),
      storage: z.number()
    }),
    availableStats: z.object({
      cpu: z.number(),
      gpu: z.number(),
      memory: z.number(),
      storage: z.number()
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
    featEndpointIp: z.boolean()
  })
);

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
export type ProviderActiveLeasesGraphDataParams = z.infer<typeof ProviderActiveLeasesGraphDataParamsSchema>;
export type ProviderActiveLeasesGraphDataResponse = z.infer<typeof ProviderActiveLeasesGraphDataResponseSchema>;
