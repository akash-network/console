import { z } from "@hono/zod-openapi";

import {
  CLOSE_REASONS,
  hardwareRequestCategoryEnum,
  hardwareRequestEventTypeEnum,
  hardwareRequestLaneEnum,
  hardwareRequestSourceEnum,
  hardwareRequestStatusEnum,
  MAX_ACTOR_LENGTH
} from "@src/hardware-request/model-schemas";

const MAX_QUEUE_PAGE_SIZE = 200;
const MAX_NOTE_LENGTH = 4000;
const DEFAULT_QUEUE_PAGE_SIZE = 50;

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
  userId: z.string().uuid(),
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

export const AddHardwareRequestNoteRequestSchema = z.object({
  data: z.object({ actor: ActorSchema, text: z.string().trim().min(1).max(MAX_NOTE_LENGTH) })
});

export const HardwareRequestQueueResponseSchema = z.object({ data: z.array(QueuedHardwareRequestSchema) });

export const HardwareRequestWithTimelineResponseSchema = z.object({
  data: QueuedHardwareRequestSchema.extend({ events: z.array(HardwareRequestEventSchema) })
});

export type HardwareRequestQueueQuery = z.infer<typeof HardwareRequestQueueQuerySchema>;
export type HardwareRequestQueueResponse = z.infer<typeof HardwareRequestQueueResponseSchema>;
export type AssignHardwareRequestOwnerRequest = z.infer<typeof AssignHardwareRequestOwnerRequestSchema>;
export type SwitchHardwareRequestLaneRequest = z.infer<typeof SwitchHardwareRequestLaneRequestSchema>;
export type ChangeHardwareRequestStatusRequest = z.infer<typeof ChangeHardwareRequestStatusRequestSchema>;
export type AddHardwareRequestNoteRequest = z.infer<typeof AddHardwareRequestNoteRequestSchema>;
export type HardwareRequestWithTimelineResponse = z.infer<typeof HardwareRequestWithTimelineResponseSchema>;
