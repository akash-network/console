import { z } from "@hono/zod-openapi";

import { type HardwareRequestConfiguration, MAX_CONTACT_EMAIL_LENGTH, MAX_GPU_MODEL_LENGTH, MAX_REGION_LENGTH } from "@src/hardware-request/model-schemas";

const MAX_DETAILS_LENGTH = 2000;
const MAX_QUANTITY = 1000;
const MAX_CONFIGURATION_SUMMARY_LENGTH = 500;
const MAX_CONFIGURATION_GPU_MODELS = 20;

const requiredText = (maxLength: number) => z.string().trim().min(1).max(maxLength);

const QuantitySchema = z.number().int().min(1).max(MAX_QUANTITY);

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

const sharedFields = {
  details: z.string().trim().max(MAX_DETAILS_LENGTH).optional(),
  email: z.string().trim().email().max(MAX_CONTACT_EMAIL_LENGTH),
  configuration: HardwareRequestConfigurationSchema.optional()
};

const HardwareRequestInputSchema = z.discriminatedUnion("category", [
  z.object({ category: z.literal("gpu_model"), gpuModel: requiredText(MAX_GPU_MODEL_LENGTH), quantity: QuantitySchema, ...sharedFields }),
  z.object({ category: z.literal("capacity"), gpuModel: requiredText(MAX_GPU_MODEL_LENGTH).optional(), quantity: QuantitySchema, ...sharedFields }),
  z.object({ category: z.literal("region"), region: requiredText(MAX_REGION_LENGTH), ...sharedFields }),
  z.object({ category: z.literal("other"), ...sharedFields, details: requiredText(MAX_DETAILS_LENGTH) })
]);

export const CreateHardwareRequestRequestSchema = z.object({
  data: HardwareRequestInputSchema
});

export const CreateHardwareRequestResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    createdAt: z.string().datetime()
  })
});

export type HardwareRequestInput = z.infer<typeof HardwareRequestInputSchema>;
export type CreateHardwareRequestRequest = z.infer<typeof CreateHardwareRequestRequestSchema>;
export type CreateHardwareRequestResponse = z.infer<typeof CreateHardwareRequestResponseSchema>;
