import { z } from "@hono/zod-openapi";

const GpuModelOptionSchema = z.object({
  name: z.string().openapi({ description: "Model as it appears in an SDL GPU attribute", example: "a100" }),
  memory: z.array(z.string()).openapi({ description: "Memory sizes this model is available with", example: ["40Gi"] }),
  interface: z.array(z.string()).openapi({ description: "Interfaces this model is available with", example: ["pcie"] }),
  providerCount: z.number().int().openapi({ description: "Online providers with free capacity on a node holding this model", example: 3 })
});

const GpuVendorOptionSchema = z.object({
  vendor: z.string().openapi({ description: "Vendor as it appears in an SDL GPU attribute", example: "nvidia" }),
  models: z.array(GpuModelOptionSchema)
});

export const PlacementOptionsResponseSchema = z.object({
  regions: z.array(z.string()).openapi({
    description: "Regions advertised by at least one online provider",
    example: ["eu-west", "na-us-west"]
  }),
  regionProviderCounts: z.record(z.string(), z.number().int()).openapi({
    description: "Online providers advertising each region, keyed by region",
    example: { "eu-west": 2, "na-us-west": 5 }
  }),
  gpus: z.array(GpuVendorOptionSchema).openapi({
    description: "GPUs that online providers have free capacity for, grouped by vendor"
  })
});
export type PlacementOptionsResponse = z.infer<typeof PlacementOptionsResponseSchema>;
