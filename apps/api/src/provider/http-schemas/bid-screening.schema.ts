import { z } from "zod";

const GpuAttributesSchema = z.object({
  vendor: z.string(),
  model: z.string().optional(),
  interface: z.string().optional(),
  memorySize: z.string().optional()
});

const ResourceUnitSchema = z
  .object({
    cpu: z.number().int().positive(),
    memory: z.number().int().positive(),
    gpu: z.number().int().min(0),
    gpuAttributes: GpuAttributesSchema.optional(),
    ephemeralStorage: z.number().int().positive(),
    persistentStorage: z.number().int().positive().optional(),
    persistentStorageClass: z.enum(["beta1", "beta2", "beta3"]).optional(),
    count: z.number().int().positive()
  })
  .refine(data => data.gpu === 0 || data.gpuAttributes !== undefined, {
    message: "gpuAttributes is required when gpu > 0",
    path: ["gpuAttributes"]
  });

const PlacementRequirementsSchema = z.object({
  attributes: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  signedBy: z
    .object({
      allOf: z.array(z.string()).default([]),
      anyOf: z.array(z.string()).default([])
    })
    .default({})
});

export const BidScreeningRequestSchema = z.object({
  data: z.object({
    resources: z.array(ResourceUnitSchema).min(1),
    requirements: PlacementRequirementsSchema.default({}),
    limit: z.number().int().min(1).max(200).default(50)
  })
});

export type BidScreeningRequest = z.infer<typeof BidScreeningRequestSchema>;

const ProviderMatchSchema = z.object({
  owner: z.string(),
  hostUri: z.string(),
  leaseCount: z.number(),
  availableCpu: z.number(),
  availableMemory: z.number(),
  availableGpu: z.number(),
  availableEphemeralStorage: z.number(),
  availablePersistentStorage: z.number()
});

const ConstraintSchema = z.object({
  name: z.string(),
  count: z.number(),
  actionableFeedback: z.string()
});

export const BidScreeningResponseSchema = z.object({
  data: z.object({
    providers: z.array(ProviderMatchSchema),
    total: z.number(),
    queryTimeMs: z.number(),
    constraints: z.array(ConstraintSchema).optional()
  })
});

export type BidScreeningResponse = z.infer<typeof BidScreeningResponseSchema>;
