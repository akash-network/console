import { z } from "@hono/zod-openapi";

import {
  CLOSE_REASONS,
  hardwareRequestCategoryEnum,
  hardwareRequestEventTypeEnum,
  hardwareRequestLaneEnum,
  hardwareRequestOfferStatusEnum,
  hardwareRequestSourceEnum,
  hardwareRequestStatusEnum,
  MAX_ACTOR_LENGTH,
  MAX_PROVIDER_ADDRESS_LENGTH
} from "@src/hardware-request/model-schemas";
import { HardwareRequestInputSchema, HardwareRequestOfferTermsSchema } from "./hardware-request.schema";

const MAX_QUEUE_PAGE_SIZE = 200;
const MAX_NOTE_LENGTH = 4000;
const DEFAULT_QUEUE_PAGE_SIZE = 50;
const MAX_OFFER_USD_PER_GPU_HOUR = 1000;

export const HardwareRequestIdParamsSchema = z.object({ id: z.string().uuid() });

export const HardwareRequestQueueQuerySchema = z.object({
  lane: z.enum(hardwareRequestLaneEnum.enumValues).optional(),
  status: z.enum(hardwareRequestStatusEnum.enumValues).optional(),
  owner: z.string().trim().min(1).optional(),
  unowned: z
    .enum(["true", "false"])
    .transform(value => value === "true")
    .optional(),
  gpuModel: z.string().trim().min(1).optional(),
  order: z.enum(["newest", "oldest"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(MAX_QUEUE_PAGE_SIZE).default(DEFAULT_QUEUE_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0)
});

const QueuedHardwareRequestSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable().describe("Null until someone signs up with the contact email of a request the team filed for them"),
  organizationId: z.string().uuid().nullable(),
  organizationName: z.string().nullable(),
  category: z.enum(hardwareRequestCategoryEnum.enumValues),
  status: z.enum(hardwareRequestStatusEnum.enumValues),
  source: z.enum(hardwareRequestSourceEnum.enumValues).nullable(),
  lane: z.enum(hardwareRequestLaneEnum.enumValues).nullable(),
  laneReason: z.string().nullable(),
  estimatedMonthlyUsd: z.number().int().nullable(),
  owner: z.string().nullable(),
  gpuModel: z.string().nullable(),
  quantity: z.number().int().nullable(),
  region: z.string().nullable(),
  details: z.string().nullable(),
  contactEmail: z.string(),
  spec: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  firstRepliedAt: z.string().datetime().nullable(),
  lastRepliedAt: z.string().datetime().nullable()
});

const HardwareRequestOfferSchema = z.object({
  id: z.string().uuid(),
  hardwareRequestId: z.string().uuid(),
  status: z.enum(hardwareRequestOfferStatusEnum.enumValues),
  providerAddress: z.string(),
  providerAudited: z.boolean(),
  providerUptime7d: z.number().nullable(),
  usdPerGpuHour: z.number(),
  terms: HardwareRequestOfferTermsSchema,
  expiresAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const HardwareRequestEventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(hardwareRequestEventTypeEnum.enumValues),
  actor: z.string().nullable(),
  payload: z.record(z.unknown()),
  createdAt: z.string().datetime()
});

const ActorSchema = z.string().trim().min(1).max(MAX_ACTOR_LENGTH).describe("The name of the team member acting, as picked in the admin app");

export const AssignHardwareRequestOwnerRequestSchema = z.object({
  data: z.object({ actor: ActorSchema, owner: z.string().trim().min(1).max(MAX_ACTOR_LENGTH).nullable() })
});

export const SwitchHardwareRequestLaneRequestSchema = z.object({
  data: z.object({ actor: ActorSchema, lane: z.enum(hardwareRequestLaneEnum.enumValues) })
});

export const ChangeHardwareRequestStatusRequestSchema = z.object({
  data: z
    .object({ actor: ActorSchema, status: z.enum(hardwareRequestStatusEnum.enumValues), closeReason: z.enum(CLOSE_REASONS).optional() })
    .refine(({ status, closeReason }) => (status === "closed") === (closeReason !== undefined), {
      message: "A closed request needs a close reason, and only a closed request takes one",
      path: ["closeReason"]
    })
});

export const CreateHardwareRequestOnBehalfRequestSchema = z.object({
  data: z.object({
    actor: ActorSchema,
    organizationId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "The organization the request is filed for, in the name of its oldest owner; without it, the request waits for whoever signs up with its contact email"
      ),
    request: HardwareRequestInputSchema
  })
});

export const HardwareRequestOfferParamsSchema = z.object({ id: z.string().uuid(), offerId: z.string().uuid() });

export const HardwareRequestOfferDraftRequestSchema = z.object({
  data: z.object({
    providerAddress: z.string().trim().min(1).max(MAX_PROVIDER_ADDRESS_LENGTH).describe("Never shown to the tenant"),
    usdPerGpuHour: z.number().positive().max(MAX_OFFER_USD_PER_GPU_HOUR),
    terms: HardwareRequestOfferTermsSchema,
    expiresAt: z
      .string()
      .datetime()
      .refine(expiresAt => new Date(expiresAt).getTime() > Date.now(), { message: "An offer must expire in the future" })
  })
});

export const HardwareRequestOfferActionRequestSchema = z.object({ data: z.object({ actor: ActorSchema }) });

export const HardwareRequestOfferResponseSchema = z.object({ data: HardwareRequestOfferSchema });

export const AddHardwareRequestNoteRequestSchema = z.object({
  data: z.object({ actor: ActorSchema, text: z.string().trim().min(1).max(MAX_NOTE_LENGTH) })
});

export const HardwareRequestQueueResponseSchema = z.object({ data: z.array(QueuedHardwareRequestSchema) });

export const HardwareRequestWithTimelineResponseSchema = z.object({
  data: QueuedHardwareRequestSchema.extend({ events: z.array(HardwareRequestEventSchema), offers: z.array(HardwareRequestOfferSchema) })
});

export type HardwareRequestQueueQuery = z.infer<typeof HardwareRequestQueueQuerySchema>;
export type HardwareRequestQueueResponse = z.infer<typeof HardwareRequestQueueResponseSchema>;
export type AssignHardwareRequestOwnerRequest = z.infer<typeof AssignHardwareRequestOwnerRequestSchema>;
export type SwitchHardwareRequestLaneRequest = z.infer<typeof SwitchHardwareRequestLaneRequestSchema>;
export type ChangeHardwareRequestStatusRequest = z.infer<typeof ChangeHardwareRequestStatusRequestSchema>;
export type CreateHardwareRequestOnBehalfRequest = z.infer<typeof CreateHardwareRequestOnBehalfRequestSchema>;
export type HardwareRequestOfferDraftRequest = z.infer<typeof HardwareRequestOfferDraftRequestSchema>;
export type HardwareRequestOfferActionRequest = z.infer<typeof HardwareRequestOfferActionRequestSchema>;
export type HardwareRequestOfferResponse = z.infer<typeof HardwareRequestOfferResponseSchema>;
export type AddHardwareRequestNoteRequest = z.infer<typeof AddHardwareRequestNoteRequestSchema>;
export type HardwareRequestWithTimelineResponse = z.infer<typeof HardwareRequestWithTimelineResponseSchema>;
