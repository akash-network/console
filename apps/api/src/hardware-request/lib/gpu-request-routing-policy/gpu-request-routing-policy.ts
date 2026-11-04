import { z } from "zod";

const DATA_CENTER_GPU_MODELS = ["B300", "B200", "H200", "H100", "A100", "L40S", "MI355X", "MI325X", "MI300X"];

/** Stand-in prices for a request without a target price, until a market price source exists (CON-1532). */
const REFERENCE_USD_PER_GPU_HOUR: Record<string, number> = {
  B300: 6,
  B200: 5,
  H200: 3.5,
  H100: 2.5,
  A100: 1.3,
  L40S: 1,
  MI355X: 3,
  MI325X: 2.5,
  MI300X: 2,
  "RTX 5090": 0.7,
  "RTX 4090": 0.45
};

const toggle = z.object({ enabled: z.boolean().default(true) });

export const gpuRequestRoutingPolicySchema = z.object({
  salesRules: z
    .object({
      monthlyValue: toggle.extend({ minUsd: z.number().nonnegative().default(5000) }).default({}),
      multiNode: toggle.extend({ minGpus: z.number().int().positive().default(8) }).default({}),
      interconnect: toggle.default({}),
      longTermDataCenter: toggle
        .extend({ minTermMonths: z.number().int().positive().default(6), gpuModels: z.array(z.string()).default(DATA_CENTER_GPU_MODELS) })
        .default({}),
      couldGrow: toggle.default({}),
      wantsToTalk: toggle.default({})
    })
    .default({}),
  salesRequiresPaymentMethod: z.boolean().default(true),
  referenceUsdPerGpuHour: z.record(z.string(), z.number().positive()).default(REFERENCE_USD_PER_GPU_HOUR)
});

export type GpuRequestRoutingPolicy = z.infer<typeof gpuRequestRoutingPolicySchema>;

export const DEFAULT_GPU_REQUEST_ROUTING_POLICY: GpuRequestRoutingPolicy = gpuRequestRoutingPolicySchema.parse({});

export function isSameGpuModel(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
