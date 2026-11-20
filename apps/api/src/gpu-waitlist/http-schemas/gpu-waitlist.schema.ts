import { z } from "@hono/zod-openapi";

import { SDL_GPU_ATTRIBUTE_VALUE } from "@src/deployment/services/gpu-bids-creator/gpu-check-sdl";
import { MAX_GPUS_PER_SETUP } from "@src/deployment/services/gpu-setup-check/gpu-setup-check.service";
import { gpuWaitlistEntrySourceEnum, gpuWaitlistEntryStatusEnum, MAX_GPU_FIELD_LENGTH } from "@src/gpu-waitlist/model-schemas";

const gpuText = z.string().trim().min(1).max(MAX_GPU_FIELD_LENGTH);
const gpuField = gpuText.regex(SDL_GPU_ATTRIBUTE_VALUE, "Use only letters, digits, dots, dashes and underscores");

export const JoinGpuWaitlistRequestSchema = z.object({
  data: z.object({
    vendor: z.literal("nvidia"),
    model: gpuField,
    memory: gpuText.optional(),
    interface: gpuField.optional(),
    gpuCount: z.number().int().min(1).max(MAX_GPUS_PER_SETUP),
    source: z.enum(gpuWaitlistEntrySourceEnum.enumValues)
  })
});

export const GpuWaitlistEntryOutputSchema = z.object({
  id: z.string().uuid(),
  vendor: z.string(),
  model: z.string(),
  memory: z.string().nullable(),
  interface: z.string().nullable(),
  gpuCount: z.number().int(),
  source: z.enum(gpuWaitlistEntrySourceEnum.enumValues),
  status: z.enum(gpuWaitlistEntryStatusEnum.enumValues),
  placeInLine: z.number().int().min(1),
  joinedAt: z.string().datetime(),
  lastNotifiedAt: z.string().datetime().nullable()
});

export const GpuWaitlistEntryResponseSchema = z.object({ data: GpuWaitlistEntryOutputSchema });

export const ListGpuWaitlistResponseSchema = z.object({ data: z.array(GpuWaitlistEntryOutputSchema) });

export const GpuWaitlistEntryIdParamsSchema = z.object({ id: z.string().uuid() });

export type JoinGpuWaitlistRequest = z.infer<typeof JoinGpuWaitlistRequestSchema>;
export type GpuWaitlistEntryOutput = z.infer<typeof GpuWaitlistEntryOutputSchema>;
export type GpuWaitlistEntryResponse = z.infer<typeof GpuWaitlistEntryResponseSchema>;
export type ListGpuWaitlistResponse = z.infer<typeof ListGpuWaitlistResponseSchema>;
