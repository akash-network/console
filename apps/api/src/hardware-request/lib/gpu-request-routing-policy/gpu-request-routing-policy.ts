import { z } from "zod";

import { isTimeZone } from "@src/hardware-request/lib/business-hours/business-hours";
import { MAX_OWNER_LENGTH, REGION_AREAS } from "@src/hardware-request/model-schemas";

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

const salesOwnerSchema = z.object({
  name: z.string().trim().min(1).max(MAX_OWNER_LENGTH),
  slackUserId: z.string().trim().min(1).optional(),
  email: z.string().email().optional()
});

const ownerRuleSchema = salesOwnerSchema.extend({
  match: z.object({ gpuClass: z.enum(["data_center", "other"]).optional(), areas: z.array(z.enum(REGION_AREAS)).min(1).optional() }).default({})
});

const businessHoursSchema = z
  .object({
    timeZone: z.string().refine(isTimeZone, "Unknown time zone").default("America/New_York"),
    days: z.array(z.number().int().min(1).max(7)).min(1).default([1, 2, 3, 4, 5]),
    startHour: z.number().int().min(0).max(23).default(9),
    endHour: z.number().int().min(1).max(24).default(17)
  })
  .refine(({ startHour, endHour }) => endHour > startHour, "Business hours must end after they start");

const laneTargetsSchema = z.object({ firstReplyBusinessHours: z.number().positive(), firstOfferBusinessHours: z.number().positive() });

/** Targets count business hours, so the 2 business days decided for a sales offer are 16 hours of a 9-to-5 day. */
const responseTargetsSchema = z.object({
  sales: laneTargetsSchema.default({ firstReplyBusinessHours: 4, firstOfferBusinessHours: 16 }),
  automated: laneTargetsSchema.default({ firstReplyBusinessHours: 8, firstOfferBusinessHours: 8 }),
  reminderLeadBusinessHours: z.number().positive().default(1)
});

export const gpuRequestRoutingPolicySchema = z.object({
  salesRules: z
    .object({
      monthlyValue: toggle.extend({ minUsd: z.number().nonnegative().default(5000) }).default({}),
      multiNode: toggle.extend({ minGpus: z.number().int().positive().default(8) }).default({}),
      interconnect: toggle.default({}),
      longTermDataCenter: toggle.extend({ minTermMonths: z.number().int().positive().default(6) }).default({}),
      couldGrow: toggle.default({}),
      wantsToTalk: toggle.default({})
    })
    .default({}),
  salesRequiresPaymentMethod: z.boolean().default(true),
  dataCenterGpuModels: z.array(z.string()).default(DATA_CENTER_GPU_MODELS),
  referenceUsdPerGpuHour: z.record(z.string(), z.number().positive()).default(REFERENCE_USD_PER_GPU_HOUR),
  owners: z.array(ownerRuleSchema).default([]),
  fallbackOwner: salesOwnerSchema.default({ name: "Sales" }),
  salesLead: salesOwnerSchema.optional(),
  businessHours: businessHoursSchema.default({}),
  responseTargets: responseTargetsSchema.default({})
});

export type GpuRequestRoutingPolicy = z.infer<typeof gpuRequestRoutingPolicySchema>;

export type SalesOwner = z.infer<typeof salesOwnerSchema>;

export const DEFAULT_GPU_REQUEST_ROUTING_POLICY: GpuRequestRoutingPolicy = gpuRequestRoutingPolicySchema.parse({});

export function isSameGpuModel(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function isDataCenterGpu(model: string, policy: GpuRequestRoutingPolicy): boolean {
  return policy.dataCenterGpuModels.some(dataCenterModel => isSameGpuModel(dataCenterModel, model));
}
