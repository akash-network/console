import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { getProviderList } from "@src/providers/providerStatusProvider";

const route = createRoute({
  method: "get",
  path: "/providers",
  summary: "Get a list of providers.",
  tags: ["Providers"],
  responses: {
    200: {
      description: "Returns a list of providers",
      content: {
        "application/json": {
          schema: z.array(
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
          )
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const providers = await cacheResponse(60, cacheKeys.getProviderList, getProviderList);
  return c.json(providers);
});
