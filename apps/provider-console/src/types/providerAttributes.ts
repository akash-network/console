import { z } from "zod";

export const providerAttributeSchemaDetailValueSchema = z.object({
  key: z.string(),
  description: z.string(),
  value: z.any().optional()
});

export const providerAttributesFormValuesSchema = z.object({
  host: z.string().min(1, { message: "Host is required." }),
  tier: z.string().optional(),
  email: z.string().email({ message: "Email is invalid." }).optional(),
  "discord-username": z.string().optional(),
  organization: z.string().optional(),
  website: z.string().optional(),
  "status-page": z.string().optional(),
  "location-region": z.string().min(1, { message: "Location region is required." }),
  country: z.string().min(2, { message: "Country must be 2 letter code." }).max(2, { message: "Country must be 2 letter code." }),
  city: z.string().max(3, { message: "City must be 3 letter code." }).min(3, { message: "City must be 3 letter code." }),
  timezone: z.string().optional(),
  "location-type": z.string().optional(),
  "hosting-provider": z.string().optional(),
  "hardware-cpu": z.string().min(1, { message: "Hardware CPU is required." }),
  "hardware-cpu-arch": z.string().optional(),
  "hardware-gpu": z.string().optional(),
  "hardware-gpu-model": z.array(providerAttributeSchemaDetailValueSchema),
  "hardware-gpu-capability": z.array(providerAttributeSchemaDetailValueSchema).optional(),
  "hardware-persistent-storage-class": z.string().optional(),
  "hardware-persistent-storage-capability": z.boolean().optional(),
  "hardware-cuda": z.string().optional(),
  datacenter: z.string().optional(),
  "hardware-memory": z.string().min(1, { message: "Hardware memory is required." }),
  "network-provider": z.string().optional(),
  "network-speed-up": z.number().optional(),
  "network-speed-down": z.number().optional(),
  "feat-persistent-storage": z.boolean().optional(),
  "feat-shm": z.boolean().optional(),
  "hardware-shm": z.array(providerAttributeSchemaDetailValueSchema).optional(),
  "feat-endpoint-ip": z.boolean().optional(),
  "feat-endpoint-custom-domain": z.boolean().optional(),
  "unknown-attributes": z
    .array(
      z.object({
        id: z.string(),
        key: z.string().min(1, { message: "Key is required." }),
        value: z.string().min(1, { message: "Value is required." })
      })
    )
    .optional()
});

export type ProviderAttributesSchema = {
  host: ProviderAttributeSchemaDetail;
  email: ProviderAttributeSchemaDetail;
  "discord-username": ProviderAttributeSchemaDetail;
  organization: ProviderAttributeSchemaDetail;
  website: ProviderAttributeSchemaDetail;
  tier: ProviderAttributeSchemaDetail;
  "status-page": ProviderAttributeSchemaDetail;
  "location-region": ProviderAttributeSchemaDetail;
  country: ProviderAttributeSchemaDetail;
  city: ProviderAttributeSchemaDetail;
  timezone: ProviderAttributeSchemaDetail;
  "location-type": ProviderAttributeSchemaDetail;
  "hosting-provider": ProviderAttributeSchemaDetail;
  "hardware-cpu": ProviderAttributeSchemaDetail;
  "hardware-cpu-arch": ProviderAttributeSchemaDetail;
  "hardware-gpu": ProviderAttributeSchemaDetail;
  "hardware-gpu-model": ProviderAttributeSchemaDetail;
  "hardware-gpu-capability": ProviderAttributeSchemaDetail;
  "hardware-persistent-storage-class": ProviderAttributeSchemaDetail;
  "hardware-persistent-storage-capability": ProviderAttributeSchemaDetail;
  "hardware-cuda": ProviderAttributeSchemaDetail;
  datacenter: ProviderAttributeSchemaDetail;
  "hardware-memory": ProviderAttributeSchemaDetail;
  "network-provider": ProviderAttributeSchemaDetail;
  "network-speed-up": ProviderAttributeSchemaDetail;
  "network-speed-down": ProviderAttributeSchemaDetail;
  "feat-persistent-storage": ProviderAttributeSchemaDetail;
  "feat-shm": ProviderAttributeSchemaDetail;
  "hardware-shm": ProviderAttributeSchemaDetail;
  "feat-endpoint-ip": ProviderAttributeSchemaDetail;
  "feat-endpoint-custom-domain": ProviderAttributeSchemaDetail;
};

export type ProviderAttributeSchemaDetail = {
  key: string;
  type: "string" | "number" | "boolean" | "option" | "multiple-option";
  required: boolean;
  description: string;
  values?: Array<ProviderAttributeSchemaDetailValue>;
};

export interface ProviderAttributeSchemaDetailValue {
  key: string;
  description: string;
  value?: any;
}

export interface ProviderRegionValue extends ProviderAttributeSchemaDetailValue {
  providers: string[];
}
