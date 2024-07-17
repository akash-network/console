import { z } from "zod";

// export type ProviderAttributesFormValues = {
//   "host-uri": string;
//   host: string;
//   email: string;
//   organization: string;
//   website: string;
//   tier: string;
//   "status-page": string;
//   "location-region": string;
//   country: string;
//   city: string;
//   timezone: string;
//   "location-type": string;
//   "hosting-provider": string;
//   "hardware-cpu": string;
//   "hardware-cpu-arch": string;
//   "hardware-gpu": string;
//   "hardware-gpu-model": ProviderAttributeSchemaDetailValue[];
//   "hardware-disk": ProviderAttributeSchemaDetailValue[];
//   "hardware-memory": string;
//   "network-provider": string;
//   "network-speed-up": number;
//   "network-speed-down": number;
//   "feat-persistent-storage": boolean;
//   "feat-persistent-storage-type": ProviderAttributeSchemaDetailValue[];
//   "workload-support-chia": boolean;
//   "workload-support-chia-capabilities": ProviderAttributeSchemaDetailValue[];
//   "feat-endpoint-ip": boolean;
//   "feat-endpoint-custom-domain": boolean;

//   // Unknown attributes
//   "unknown-attributes": { id: string; key: string; value: string }[];
// };

export const providerAttributeSchemaDetailValueSchema = z.object({
  key: z.string(),
  description: z.string(),
  value: z.any().optional()
});

export const providerAttributesFormValuesSchema = z.object({
  "host-uri": z.string({ message: "Host URI is required." }),
  host: z.string({ message: "Host is required." }),
  email: z.string({ message: "Email is required." }),
  organization: z.string({ message: "Organization is required." }),
  website: z.string(),
  tier: z.string(),
  "status-page": z.string(),
  "location-region": z.string({ message: "Location region is required." }),
  country: z.string().min(2, { message: "Country must be 2 letter code." }).max(2, { message: "Country must be 2 letter code." }),
  city: z.string().max(3, { message: "City must be 3 letter code." }).min(3, { message: "City must be 3 letter code." }),
  timezone: z.string(),
  "location-type": z.string(),
  "hosting-provider": z.string(),
  "hardware-cpu": z.string({ message: "Hardware CPU is required." }),
  "hardware-cpu-arch": z.string(),
  "hardware-gpu": z.string(),
  "hardware-gpu-model": z.array(providerAttributeSchemaDetailValueSchema),
  "hardware-disk": z.array(providerAttributeSchemaDetailValueSchema, { message: "Hardware disk is required." }),
  "hardware-memory": z.string({ message: "Hardware memory is required." }),
  "network-provider": z.string(),
  "network-speed-up": z.number(),
  "network-speed-down": z.number(),
  "feat-persistent-storage": z.boolean(),
  "feat-persistent-storage-type": z.array(providerAttributeSchemaDetailValueSchema),
  "workload-support-chia": z.boolean(),
  "workload-support-chia-capabilities": z.array(providerAttributeSchemaDetailValueSchema),
  "feat-endpoint-ip": z.boolean(),
  "feat-endpoint-custom-domain": z.boolean(),
  "unknown-attributes": z.array(
    z.object({
      id: z.string(),
      key: z.string({ message: "Key is required." }),
      value: z.string({ message: "Value is required." })
    })
  )
});

export type ProviderAttributesSchema = {
  host: ProviderAttributeSchemaDetail;
  email: ProviderAttributeSchemaDetail;
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
  "hardware-disk": ProviderAttributeSchemaDetail;
  "hardware-memory": ProviderAttributeSchemaDetail;
  "network-provider": ProviderAttributeSchemaDetail;
  "network-speed-up": ProviderAttributeSchemaDetail;
  "network-speed-down": ProviderAttributeSchemaDetail;
  "feat-persistent-storage": ProviderAttributeSchemaDetail;
  "feat-persistent-storage-type": ProviderAttributeSchemaDetail;
  "workload-support-chia": ProviderAttributeSchemaDetail;
  "workload-support-chia-capabilities": ProviderAttributeSchemaDetail;
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
