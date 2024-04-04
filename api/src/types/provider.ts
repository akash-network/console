export interface ProviderList {
  owner: string;
  name: string;
  hostUri: string;
  createdHeight: number;
  email: string;
  website: string;
  lastCheckDate: Date;
  deploymentCount: number;
  leaseCount: number;
  cosmosSdkVersion: string;
  akashVersion: string;
  ipRegion: string;
  ipRegionCode: string;
  ipCountry: string;
  ipCountryCode: string;
  ipLat: string;
  ipLon: string;
  uptime1d: number;
  uptime7d: number;
  uptime30d: number;
  isValidVersion: boolean;
  isOnline: boolean;
  isAudited: boolean;
  gpuModels: { vendor: string; model: string; ram: string; interface: string }[];
  activeStats: {
    cpu: number;
    gpu: number;
    memory: number;
    storage: number;
  };
  pendingStats: {
    cpu: number;
    gpu: number;
    memory: number;
    storage: number;
  };
  availableStats: {
    cpu: number;
    gpu: number;
    memory: number;
    storage: number;
  };
  attributes: Array<{
    key: string;
    value: string;
    auditedBy: string[];
  }>;

  // Attributes schema
  host: string;
  organization: string;
  statusPage: string;
  locationRegion: string;
  country: string;
  city: string;
  timezone: string;
  locationType: string;
  hostingProvider: string;
  hardwareCpu: string;
  hardwareCpuArch: string;
  hardwareGpuVendor: string;
  hardwareGpuModels: string[];
  hardwareDisk: string[];
  featPersistentStorage: boolean;
  featPersistentStorageType: string[];
  hardwareMemory: string;
  networkProvider: string;
  networkSpeedDown: number;
  networkSpeedUp: number;
  tier: string;
  featEndpointCustomDomain: boolean;
  workloadSupportChia: boolean;
  workloadSupportChiaCapabilities: string[];
  featEndpointIp: boolean;
}

export interface ProviderDetail extends ProviderList {
  uptime: Array<{
    id: string;
    isOnline: boolean;
    checkDate: Date;
  }>;
}

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

export type ProviderAttributeSchemaDetailValue = { key: string; description: string; value?: string };

export type Auditor = {
  id: string;
  name: string;
  address: string;
  website: string;
};
