import { z } from "@hono/zod-openapi";

const GpuModelVariantSchema = z.object({
  memory: z.string().nullable().openapi({ description: "Memory size the SDL pins, or null to leave it unpinned", example: "80Gi" }),
  interface: z.string().nullable().openapi({ description: "Interface the SDL pins, or null to leave it unpinned", example: "sxm" }),
  providerCount: z.number().int().openapi({ description: "Audited providers with free capacity that advertise this exact GPU key", example: 2 })
});

const GpuModelOptionSchema = z.object({
  name: z.string().openapi({ description: "Model as it appears in an SDL GPU attribute", example: "a100" }),
  memory: z.array(z.string()).openapi({ description: "Memory sizes a provider would bid on with the interface left unpinned", example: ["40Gi"] }),
  interface: z.array(z.string()).openapi({ description: "Interfaces a provider would bid on with the memory left unpinned", example: ["pcie"] }),
  providerCount: z
    .number()
    .int()
    .openapi({ description: "Audited providers with free capacity that would bid on this model with memory and interface unpinned", example: 3 }),
  variants: z
    .array(GpuModelVariantSchema)
    .openapi({ description: "Every memory and interface combination at least one provider would bid on, the model alone included" })
});

const GpuVendorOptionSchema = z.object({
  vendor: z.string().openapi({ description: "Vendor as it appears in an SDL GPU attribute", example: "nvidia" }),
  models: z.array(GpuModelOptionSchema)
});

export const PlacementOptionsResponseSchema = z.object({
  regions: z.array(z.string()).openapi({
    description: "Regions declared by at least one online provider and signed by the Console auditor",
    example: ["eu-west", "na-us-west"]
  }),
  regionProviderCounts: z.record(z.string(), z.number().int()).openapi({
    description: "Audited online providers in each region, keyed by region",
    example: { "eu-west": 2, "na-us-west": 5 }
  }),
  gpus: z.array(GpuVendorOptionSchema).openapi({
    description: "GPUs that audited online providers have free capacity for and would bid on, grouped by vendor"
  })
});
export type PlacementOptionsResponse = z.infer<typeof PlacementOptionsResponseSchema>;
