import { z } from "zod";

export const deploymentRowSchema = z.object({
  dseq: z.string(),
  owner: z.string(),
  name: z.string(),
  status: z.string(),
  escrowBalance: z.number(),
  escrowAccount: z.object({
    id: z.object({
      scope: z.string(),
      xid: z.string()
    }),
    owner: z.string(),
    state: z.string(),
    balance: z.object({
      denom: z.string(),
      amount: z.string()
    }),
    transferred: z.object({
      denom: z.string(),
      amount: z.string()
    }),
    settled_at: z.string(),
    depositor: z.string(),
    funds: z.object({
      denom: z.string(),
      amount: z.string()
    })
  }),
  createdHeight: z.number(),
  cpuUnits: z.number(),
  gpuUnits: z.number(),
  memoryQuantity: z.number(),
  storageQuantity: z.number(),
  leases: z.array(
    z.object({
      id: z.string(),
      owner: z.string(),
      provider: z.object({
        owner: z.string(),
        name: z.string(),
        hostUri: z.string(),
        createdHeight: z.number(),
        email: z.string().nullable(),
        website: z.string().nullable(),
        lastCheckDate: z.string(),
        deploymentCount: z.number(),
        leaseCount: z.number(),
        cosmosSdkVersion: z.string(),
        akashVersion: z.string(),
        ipRegion: z.string(),
        ipRegionCode: z.string(),
        ipCountry: z.string(),
        ipCountryCode: z.string(),
        ipLat: z.string(),
        ipLon: z.string(),
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
        uptime1d: z.number(),
        uptime7d: z.number(),
        uptime30d: z.number(),
        isValidVersion: z.boolean(),
        isOnline: z.boolean(),
        isAudited: z.boolean(),
        attributes: z.array(
          z.object({
            key: z.string(),
            value: z.string(),
            auditedBy: z.array(z.string())
          })
        ),
        host: z.string(),
        organization: z.string().nullable(),
        statusPage: z.string().nullable(),
        locationRegion: z.array(z.string()),
        country: z.string().nullable(),
        city: z.string().nullable(),
        timezone: z.array(z.string()),
        locationType: z.array(z.string()),
        hostingProvider: z.string().nullable(),
        hardwareCpu: z.array(z.string()),
        hardwareCpuArch: z.array(z.string()),
        hardwareGpuVendor: z.array(z.string()),
        hardwareGpuModels: z.array(z.string()),
        hardwareDisk: z.array(z.string()),
        featPersistentStorage: z.boolean(),
        featPersistentStorageType: z.array(z.string()),
        hardwareMemory: z.array(z.string()),
        networkProvider: z.string().nullable(),
        networkSpeedDown: z.number(),
        networkSpeedUp: z.number(),
        tier: z.array(z.string()),
        featEndpointCustomDomain: z.boolean(),
        workloadSupportChia: z.boolean(),
        workloadSupportChiaCapabilities: z.array(z.string()),
        featEndpointIp: z.boolean()
      }),
      dseq: z.string(),
      gseq: z.number(),
      oseq: z.number(),
      state: z.string(),
      price: z.object({
        denom: z.string(),
        amount: z.string()
      })
    })
  )
});
export type DeploymentRowType = z.infer<typeof deploymentRowSchema>;
