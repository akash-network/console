export interface ProviderList {
  owner: string;
  name: string | null;
  hostUri: string;
  createdHeight: number;
  email: string | null | undefined;
  website: string | null | undefined;
  lastCheckDate: Date | null;
  deploymentCount: number | null | undefined;
  leaseCount: number | null | undefined;
  cosmosSdkVersion: string;
  akashVersion: string;
  ipRegion: string | null;
  ipRegionCode: string | null;
  ipCountry: string | null;
  ipCountryCode: string | null;
  ipLat: string | null;
  ipLon: string | null;
  uptime1d: number | null;
  uptime7d: number | null;
  uptime30d: number | null;
  isValidVersion: boolean;
  isOnline: boolean;
  lastOnlineDate: Date | null;
  isAudited: boolean;
  gpuModels: Array<{
    vendor: string;
    model: string;
    ram: string;
    interface: string;
  }>;
  stats: ProviderCapacityStats;
  attributes: Array<{
    key: string;
    value: string;
    auditedBy: string[];
  }>;

  // Attributes schema
  host: string | null;
  organization: string | null;
  statusPage: string | null;
  locationRegion: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  locationType: string | null;
  hostingProvider: string | null;
  hardwareCpu: string | null;
  hardwareCpuArch: string | null;
  hardwareGpuVendor: string | null;
  hardwareGpuModels: string[] | null;
  hardwareDisk: string[] | null;
  featPersistentStorage: boolean;
  featPersistentStorageType: string[] | null;
  hardwareMemory: string | null;
  networkProvider: string | null;
  networkSpeedDown: number;
  networkSpeedUp: number;
  tier: string | null;
  featEndpointCustomDomain: boolean;
  workloadSupportChia: boolean;
  workloadSupportChiaCapabilities: string[] | null;
  featEndpointIp: boolean;
}

export interface ProviderCapacityStats {
  cpu: StatsItem;
  gpu: StatsItem;
  memory: StatsItem;
  storage: {
    ephemeral: StatsItem;
    persistent: StatsItem;
    total: StatsItem;
  };
}

export interface ProviderDetail extends ProviderList {
  uptime: {
    id: string;
    isOnline: boolean;
    checkDate: Date;
  }[];
}

export interface StatsItem {
  active: number;
  available: number;
  pending: number;
  total: number;
}
