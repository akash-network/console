import { z } from "zod";

const attributeSchemaType = z.object({
  key: z.string(),
  type: z.enum(["string", "number", "boolean", "option", "multiple-option"]),
  required: z.boolean(),
  description: z.string(),
  values: z
    .array(
      z.object({
        key: z.string(),
        description: z.string(),
        value: z.any().nullable()
      })
    )
    .nullable()
    .optional()
});

export const ProviderAttributesSchemaResponseSchema = z.object({
  host: attributeSchemaType,
  email: attributeSchemaType,
  organization: attributeSchemaType,
  website: attributeSchemaType,
  tier: attributeSchemaType,
  "status-page": attributeSchemaType,
  "location-region": attributeSchemaType,
  country: attributeSchemaType,
  city: attributeSchemaType,
  timezone: attributeSchemaType,
  "location-type": attributeSchemaType,
  "hosting-provider": attributeSchemaType,
  "hardware-cpu": attributeSchemaType,
  "hardware-cpu-arch": attributeSchemaType,
  "hardware-gpu": attributeSchemaType,
  "hardware-gpu-model": attributeSchemaType,
  "hardware-disk": attributeSchemaType,
  "hardware-memory": attributeSchemaType,
  "network-provider": attributeSchemaType,
  "network-speed-up": attributeSchemaType,
  "network-speed-down": attributeSchemaType,
  "feat-persistent-storage": attributeSchemaType,
  "feat-persistent-storage-type": attributeSchemaType,
  "workload-support-chia": attributeSchemaType,
  "workload-support-chia-capabilities": attributeSchemaType,
  "feat-endpoint-ip": attributeSchemaType,
  "feat-endpoint-custom-domain": attributeSchemaType
});

export type ProviderAttributesSchemaResponse = z.infer<typeof ProviderAttributesSchemaResponseSchema>;
