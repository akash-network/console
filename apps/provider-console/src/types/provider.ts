export interface ProviderDetails {
  owner: string;
  name: string | null;
  hostUri: string;
  createdHeight: number;
  email: string | null;
  website: string;
  lastCheckDate: string;
  deploymentCount: number;
  leaseCount: number;
  cosmosSdkVersion: string | null;
  akashVersion: string | null;
  ipRegion: string;
  ipRegionCode: string;
  ipCountry: string;
  ipCountryCode: string;
  ipLat: string;
  ipLon: string;
  activeStats: Stats;
  pendingStats: Stats;
  availableStats: Stats;
  gpuModels: string[];
  uptime1d: number;
  uptime7d: number;
  uptime30d: number;
  isValidVersion: boolean;
  isOnline: boolean;
  lastOnlineDate: string;
  isAudited: boolean;
  attributes: Attribute[];
  host: string | null;
  organization: string | null;
  statusPage: string | null;
  locationRegion: string[];
  country: string | null;
  city: string | null;
  timezone: string[];
  locationType: string[];
  hostingProvider: string | null;
  hardwareCpu: string[];
  hardwareCpuArch: string[];
  hardwareGpuVendor: string[];
  hardwareGpuModels: string[];
  hardwareDisk: string[];
  featPersistentStorage: boolean;
  featPersistentStorageType: string[];
  hardwareMemory: string[];
  networkProvider: string | null;
  networkSpeedDown: number;
  networkSpeedUp: number;
  tier: string[];
  featEndpointCustomDomain: boolean;
  workloadSupportChia: boolean;
  workloadSupportChiaCapabilities: string[];
  featEndpointIp: boolean;
  uptime: Uptime[];
  stats: {
    storage: {
      ephemeral: StatStatus;
      persistent: StatStatus;
    };
  };
}

interface StatStatus {
  available: number;
  active: number;
  pending: number;
}

interface Stats {
  cpu: number;
  gpu: number;
  memory: number;
  storage: number;
}

interface Attribute {
  key: string;
  value: string;
  auditedBy: string[];
}

interface Uptime {
  id: string;
  isOnline: boolean;
  checkDate: string;
}

interface LeaseStats {
  date: string;
  height: number;
  activeLeaseCount: number;
  totalLeaseCount: number;
  dailyLeaseCount: number;
  totalUAktEarned: number;
  dailyUAktEarned: number;
  totalUUsdcEarned: number;
  dailyUUsdcEarned: number;
  totalUUsdEarned: number;
  dailyUUsdEarned: number;
  activeCPU: number;
  activeGPU: number;
  activeMemory: string;
  activeEphemeralStorage: string;
  activePersistentStorage: string;
  activeStorage: string;
}

export interface ProviderDashoard {
  current: LeaseStats;
  previous: LeaseStats;
}

export interface ProviderPricingType {
  cpu: number;
  memory: number;
  storage: number;
  persistentStorage: number;
  gpu: number;
  ipScalePrice: number;
  endpointBidPrice: number;
}

interface BlockDevice {
  name: string;
  size: number;
  type: string;
  fstype: string | null;
  mountpoint: string | null;
  rota: boolean;
  storage_type: "hdd" | "ssd";
}

interface NodeDrives {
  blockdevices: BlockDevice[];
}

export interface PersistentStorageResponse {
  unformatted_drives: {
    [nodeName: string]: NodeDrives;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in_progress" | "failed" | "not_started";
  start_time: string;
  end_time: string;
}

export interface ActionStatus {
  id: string;
  name: string;
  status: "completed" | "in_progress" | "failed" | "not_started";
  start_time: string;
  end_time: string;
  tasks: Task[];
}

export interface TaskLogs {
  [taskId: string]: string;
}

export interface StaticLog {
  type: string;
  message: string;
}

export interface StaticLogsResponse {
  logs: StaticLog[];
}
