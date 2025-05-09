export interface ProviderList {
  owner: string;
  name: string | null;
  hostUri: string;
  createdHeight: number;
  email: string | null | undefined;
  website: string | null | undefined;
  lastCheckDate: Date | null | undefined;
  deploymentCount: number | null | undefined;
  leaseCount: number | null | undefined;
  cosmosSdkVersion: string | null | undefined;
  akashVersion: string | null | undefined;
  ipRegion: string | null | undefined;
  ipRegionCode: string | null | undefined;
  ipCountry: string | null | undefined;
  ipCountryCode: string | null | undefined;
  ipLat: string | null | undefined;
  ipLon: string | null | undefined;
  uptime1d: number | null | undefined;
  uptime7d: number | null | undefined;
  uptime30d: number | null | undefined;
  isValidVersion: boolean;
  isOnline: boolean | null | undefined;
  lastOnlineDate: Date | null | undefined;
  isAudited: boolean;
  gpuModels: Array<{
    vendor: string;
    model: string;
    ram: string;
    interface: string;
  }>;
  stats: {
    cpu: StatsItem;
    gpu: StatsItem;
    memory: StatsItem;
    storage: {
      ephemeral: StatsItem;
      persistent: StatsItem;
    };
  };
  /** @deprecated use `stats` instead */
  activeStats: {
    cpu: number;
    gpu: number;
    memory: number;
    storage: number;
  };
  /** @deprecated use `stats` instead */
  pendingStats: {
    cpu: number;
    gpu: number;
    memory: number;
    storage: number;
  };
  /** @deprecated use `stats` instead */
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
  host: string | null | undefined;
  organization: string | null | undefined;
  statusPage: string | null | undefined;
  locationRegion: string | null | undefined;
  country: string | null | undefined;
  city: string | null | undefined;
  timezone: string | null | undefined;
  locationType: string | null | undefined;
  hostingProvider: string | null | undefined;
  hardwareCpu: string | null | undefined;
  hardwareCpuArch: string | null | undefined;
  hardwareGpuVendor: string | null | undefined;
  hardwareGpuModels: string[] | null | undefined;
  hardwareDisk: string[] | null | undefined;
  featPersistentStorage: boolean | null | undefined;
  featPersistentStorageType: string[] | null | undefined;
  hardwareMemory: string | null | undefined;
  networkProvider: string | null | undefined;
  networkSpeedDown: number | null | undefined;
  networkSpeedUp: number | null | undefined;
  tier: string | null | undefined;
  featEndpointCustomDomain: boolean | null | undefined;
  workloadSupportChia: boolean | null | undefined;
  workloadSupportChiaCapabilities: string[] | null | undefined;
  featEndpointIp: boolean | null | undefined;
}

export interface ProviderDetail extends ProviderList {
  uptime: {
    id: string;
    isOnline: boolean;
    checkDate: Date;
  }[];
}

export type Auditor = {
  id: string;
  name: string;
  address: string;
  website: string;
};

export interface StatsItem {
  active: number;
  available: number;
  pending: number;
}
