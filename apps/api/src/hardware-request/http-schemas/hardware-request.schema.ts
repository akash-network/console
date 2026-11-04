import { z } from "@hono/zod-openapi";

import {
  TENANT_VISIBLE_OFFER_STATUSES,
  type TenantHardwareRequestOffer
} from "@src/hardware-request/lib/hardware-request-tenant-offer/hardware-request-tenant-offer";
import {
  hardwareRequestCategoryEnum,
  type HardwareRequestConfiguration,
  hardwareRequestLaneEnum,
  type HardwareRequestOfferTerms,
  hardwareRequestSourceEnum,
  type HardwareRequestSpec,
  hardwareRequestStatusEnum,
  MAX_CONTACT_EMAIL_LENGTH,
  MAX_GPU_MODEL_LENGTH,
  MAX_OFFER_LOCATION_LENGTH,
  MAX_REGION_LENGTH,
  REGION_AREAS,
  REQUEST_TERMS,
  UPTIME_SLAS
} from "@src/hardware-request/model-schemas";

const MAX_DETAILS_LENGTH = 2000;
const MAX_QUANTITY = 1000;
const MAX_CONFIGURATION_SUMMARY_LENGTH = 500;
const MAX_CONFIGURATION_GPU_MODELS = 20;
const MAX_STORAGE_TB_PER_NODE = 1000;
const MAX_USD_PER_GPU_HOUR = 1000;
const MAX_CONTACT_FIELD_LENGTH = 100;

const requiredText = (maxLength: number) => z.string().trim().min(1).max(maxLength);

const QuantitySchema = z.number().int().min(1).max(MAX_QUANTITY);

const UsdPerGpuHourSchema = z.number().positive().max(MAX_USD_PER_GPU_HOUR);

const HardwareRequestConfigurationSchema = z.object({
  summary: z.string().max(MAX_CONFIGURATION_SUMMARY_LENGTH),
  cpu: z.number().nonnegative(),
  memoryBytes: z.number().int().nonnegative(),
  storageBytes: z.number().int().nonnegative(),
  region: z.string().max(MAX_REGION_LENGTH).nullable(),
  gpu: z
    .object({
      count: z.number().int().nonnegative(),
      models: z.array(z.string().max(MAX_GPU_MODEL_LENGTH)).max(MAX_CONFIGURATION_GPU_MODELS)
    })
    .optional()
}) satisfies z.ZodType<HardwareRequestConfiguration>;

export const HardwareRequestOfferTermsSchema = z.object({
  gpu: z.object({
    model: requiredText(MAX_GPU_MODEL_LENGTH),
    count: z.number().int().min(1).max(MAX_QUANTITY),
    interconnect: z.enum(["none", "server", "cluster"])
  }),
  location: requiredText(MAX_OFFER_LOCATION_LENGTH),
  availableFrom: z.string().date(),
  term: z.enum(REQUEST_TERMS),
  sla: z.enum(UPTIME_SLAS).nullable(),
  storage: z.object({ tbPerNode: z.number().nonnegative().max(MAX_STORAGE_TB_PER_NODE), nvme: z.boolean() }),
  uplinkGbps: z.union([z.literal(1), z.literal(10), z.literal(25)]).nullable()
}) satisfies z.ZodType<HardwareRequestOfferTerms>;

const HardwareRequestSpecSchema = z.object({
  gpu: z.object({
    model: requiredText(MAX_GPU_MODEL_LENGTH),
    count: QuantitySchema,
    interconnect: z.enum(["none", "server", "cluster"]),
    fabric: z.enum(["any", "infiniband", "roce"]).optional(),
    fabricGbps: z.union([z.literal(200), z.literal(400), z.literal(800)]).optional()
  }),
  region: z
    .object({ mode: z.enum(["any", "only", "except"]), areas: z.array(z.enum(REGION_AREAS)).max(REGION_AREAS.length) })
    .refine(region => region.mode === "any" || region.areas.length > 0, { message: "Pick at least one area", path: ["areas"] })
    .refine(region => new Set(region.areas).size === region.areas.length, { message: "Pick each area once", path: ["areas"] })
    .refine(region => region.mode !== "except" || region.areas.length < REGION_AREAS.length, {
      message: "Excluding every area leaves no region",
      path: ["areas"]
    }),
  uplinkGbps: z.union([z.literal(1), z.literal(10), z.literal(25)]).nullable(),
  storage: z.object({ tbPerNode: z.number().nonnegative().max(MAX_STORAGE_TB_PER_NODE), nvme: z.boolean() }),
  sla: z.enum(UPTIME_SLAS).nullable(),
  targetPrice: z
    .object({ minUsdPerGpuHour: UsdPerGpuHourSchema.optional(), maxUsdPerGpuHour: UsdPerGpuHourSchema.optional() })
    .refine(({ minUsdPerGpuHour, maxUsdPerGpuHour }) => !minUsdPerGpuHour || !maxUsdPerGpuHour || minUsdPerGpuHour <= maxUsdPerGpuHour, {
      message: "The minimum price is above the maximum",
      path: ["minUsdPerGpuHour"]
    })
    .nullable(),
  term: z.enum(REQUEST_TERMS),
  start: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("asap") }),
    z.object({ kind: z.literal("flexible") }),
    z.object({ kind: z.literal("date"), date: z.string().date() })
  ]),
  couldGrow: z.boolean(),
  wantsToTalk: z.boolean(),
  company: z.string().trim().max(MAX_CONTACT_FIELD_LENGTH).optional(),
  phone: z.string().trim().max(MAX_CONTACT_FIELD_LENGTH).optional()
}) satisfies z.ZodType<HardwareRequestSpec>;

const sharedFields = {
  details: z.string().trim().max(MAX_DETAILS_LENGTH).optional(),
  email: z.string().trim().email().max(MAX_CONTACT_EMAIL_LENGTH),
  configuration: HardwareRequestConfigurationSchema.optional(),
  source: z.enum(hardwareRequestSourceEnum.enumValues).optional()
};

export const HardwareRequestInputSchema = z.discriminatedUnion("category", [
  z.object({ category: z.literal("gpu_model"), gpuModel: requiredText(MAX_GPU_MODEL_LENGTH), quantity: QuantitySchema, ...sharedFields }),
  z.object({ category: z.literal("capacity"), gpuModel: requiredText(MAX_GPU_MODEL_LENGTH).optional(), quantity: QuantitySchema, ...sharedFields }),
  z.object({ category: z.literal("region"), region: requiredText(MAX_REGION_LENGTH), ...sharedFields }),
  z.object({ category: z.literal("other"), ...sharedFields, details: requiredText(MAX_DETAILS_LENGTH) }),
  z.object({ category: z.literal("quote"), spec: HardwareRequestSpecSchema, ...sharedFields })
]);

export const CreateHardwareRequestRequestSchema = z.object({
  data: HardwareRequestInputSchema
});

export const CreateHardwareRequestResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    lane: z.enum(hardwareRequestLaneEnum.enumValues),
    firstReplyDueAt: z.string().datetime().nullable().describe("When the team promises its first reply, counted in business hours for the request's lane")
  })
});

const HardwareRequestSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  organizationId: z.string().uuid().nullable(),
  category: z.enum(hardwareRequestCategoryEnum.enumValues),
  status: z.enum(hardwareRequestStatusEnum.enumValues),
  source: z.enum(hardwareRequestSourceEnum.enumValues).nullable(),
  gpuModel: z.string().nullable(),
  quantity: z.number().int().nullable(),
  region: z.string().nullable(),
  details: z.string().nullable(),
  contactEmail: z.string(),
  spec: HardwareRequestSpecSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const HardwareRequestResponseSchema = z.object({ data: HardwareRequestSchema });

export const ListHardwareRequestsResponseSchema = z.object({
  data: z.array(HardwareRequestSchema)
});

export const HardwareRequestIdParamsSchema = z.object({ id: z.string().uuid() });

const TenantHardwareRequestOfferSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TENANT_VISIBLE_OFFER_STATUSES),
  expired: z.boolean().describe("A published offer past its expiry, which can no longer be accepted"),
  providerAudited: z.boolean(),
  providerUptime7d: z.number().nullable().describe("The provider's uptime over the 7 days before the offer was written, from 0 to 1"),
  usdPerGpuHour: z.number(),
  estimatedMonthlyUsd: z.number().int().describe("The price per GPU-hour for every GPU in the offer, over 730 hours"),
  terms: HardwareRequestOfferTermsSchema,
  expiresAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable()
}) satisfies z.ZodType<TenantHardwareRequestOffer>;

export const HardwareRequestOfferIdParamsSchema = z.object({ id: z.string().uuid(), offerId: z.string().uuid() });

export const TenantHardwareRequestOfferResponseSchema = z.object({ data: TenantHardwareRequestOfferSchema });

export const ListHardwareRequestOffersResponseSchema = z.object({ data: z.array(TenantHardwareRequestOfferSchema) });

export type HardwareRequestInput = z.infer<typeof HardwareRequestInputSchema>;
export type CreateHardwareRequestRequest = z.infer<typeof CreateHardwareRequestRequestSchema>;
export type CreateHardwareRequestResponse = z.infer<typeof CreateHardwareRequestResponseSchema>;
export type TenantHardwareRequestOfferResponse = z.infer<typeof TenantHardwareRequestOfferResponseSchema>;
export type ListHardwareRequestOffersResponse = z.infer<typeof ListHardwareRequestOffersResponseSchema>;
export type HardwareRequestResponse = z.infer<typeof HardwareRequestResponseSchema>;
export type ListHardwareRequestsResponse = z.infer<typeof ListHardwareRequestsResponseSchema>;
