import { z } from "@hono/zod-openapi";

export const GpuSupplyRequestSchema = z.object({
  vendor: z.string().min(1).openapi({ description: "GPU vendor as it appears in an SDL GPU attribute, matched case-insensitively", example: "nvidia" }),
  model: z.string().min(1).openapi({ description: "GPU model as it appears in an SDL GPU attribute, matched case-insensitively", example: "h100" })
});
export type GpuSupplyRequest = z.infer<typeof GpuSupplyRequestSchema>;

const GpuSupplyNodeSchema = z.object({
  owner: z.string().openapi({ description: "Address of the provider owning the node", example: "akash1abc" }),
  node: z.number().int().openapi({ description: "Position of the node in the provider's inventory", example: 1 }),
  vendor: z.string().openapi({ example: "nvidia" }),
  model: z.string().openapi({ example: "h100" }),
  memory: z.string().openapi({ description: "Memory size of the GPU, empty when not reported", example: "80Gi" }),
  interface: z.string().openapi({ description: "Interface of the GPU, empty when not reported", example: "sxm" }),
  units: z.number().int().openapi({ description: "Devices of exactly this kind on the node, free or not", example: 8 }),
  nodeFreeUnits: z
    .number()
    .int()
    .nullable()
    .openapi({ description: "GPUs the node has free across all of its devices, or null when it reports unlimited capacity", example: 8 })
});

export const GpuSupplyResponseSchema = z.object({
  data: z.array(GpuSupplyNodeSchema).openapi({ description: "Provider nodes of audited online providers with free GPUs of the requested model" })
});
export type GpuSupplyResponse = z.infer<typeof GpuSupplyResponseSchema>;
