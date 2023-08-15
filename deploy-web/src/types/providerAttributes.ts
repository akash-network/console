export type ProviderAttributesFormValues = {
  "host-uri": string;
  host: string;
  email: string;
  organization: string;
  website: string;
  tier: string;
  "status-page": string;
  "location-region": string;
  country: string;
  city: string;
  timezone: string;
  "location-type": string;
  "hosting-provider": string;
  "hardware-cpu": string;
  "hardware-cpu-arch": string;
  "hardware-gpu": string;
  "hardware-gpu-model": ProviderAttributeSchemaDetailValue[];
  "hardware-disk": ProviderAttributeSchemaDetailValue[];
  "hardware-memory": string;
  "network-provider": string;
  "network-speed-up": number;
  "network-speed-down": number;
  "feat-persistent-storage": boolean;
  "feat-persistent-storage-type": ProviderAttributeSchemaDetailValue[];
  "workload-support-chia": boolean;
  "workload-support-chia-capabilities": ProviderAttributeSchemaDetailValue[];
  "feat-endpoint-ip": boolean;
  "feat-endpoint-custom-domain": boolean;

  // Unknown attributes
  "unknown-attributes": { id: string; key: string; value: string }[];
};

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

export type ProviderAttributeSchemaDetailValue = { key: "string"; description: string; value?: any };
