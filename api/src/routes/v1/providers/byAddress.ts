import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getProviderDetail } from "@src/services/db/providerStatusService";
import { openApiExampleProviderAddress } from "@src/utils/constants";

const route = createRoute({
  method: "get",
  path: "/providers/{address}",
  summary: "Get a provider details.",
  tags: ["Providers"],
  request: {
    params: z.object({
      address: z.string().openapi({
        description: "Provider Address",
        example: openApiExampleProviderAddress
      })
    })
  },
  responses: {
    200: {
      description: "Return a provider details",
      content: {
        "application/json": {
          schema: z.object({
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
            featEndpointIp: z.boolean(),
            uptime: z.array(
              z.object({
                id: z.string(),
                isOnline: z.boolean(),
                checkDate: z.string()
              })
            )
          })
        }
      }
    },
    404: {
      description: "Provider not found"
    },
    400: {
      description: "Invalid address"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  if (!c.req.valid("param").address) {
    return c.text("Address is undefined.", 400);
  }

  const provider = await getProviderDetail(c.req.valid("param").address);

  if (!provider) {
    return c.text("Provider not found.", 404);
  }

  return c.json(provider);
});
