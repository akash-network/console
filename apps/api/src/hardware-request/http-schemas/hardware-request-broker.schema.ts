import { z } from "@hono/zod-openapi";

import {
  hardwareRequestCategoryEnum,
  hardwareRequestLaneEnum,
  hardwareRequestSourceEnum,
  hardwareRequestStatusEnum
} from "@src/hardware-request/model-schemas";

const MAX_QUEUE_PAGE_SIZE = 200;
const DEFAULT_QUEUE_PAGE_SIZE = 50;

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

export const HardwareRequestQueueResponseSchema = z.object({ data: z.array(QueuedHardwareRequestSchema) });

export type HardwareRequestQueueQuery = z.infer<typeof HardwareRequestQueueQuerySchema>;
export type HardwareRequestQueueResponse = z.infer<typeof HardwareRequestQueueResponseSchema>;
