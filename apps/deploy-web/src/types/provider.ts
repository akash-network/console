export interface RpcProvider {
  owner: string;
  host_uri: string;
  // attributes: Array<{
  //   key: string;
  //   value: string;
  // }>;
  info: {
    email: string;
    website: string;
  };
}

export interface ProviderSnapshot {
  id: string;
  isOnline: boolean;
  checkDate: string;
  error: string;
  deploymentCount: number;
  leaseCount: number;
  activeCPU: number;
  activeGPU: number;
  activeMemory: number;
  activeStorage: number;
  pendingCPU: number;
  pendingGPU: number;
  pendingMemory: number;
  pendingStorage: number;
  availableCPU: number;
  availableGPU: number;
  availableMemory: number;
  availableStorage: number;
}

export interface ApiProvider {
  owner: string;
  name: string;
  hostUri: string;
  createdHeight: number;
  email: string;
  website: string;
  lastCheckDate: string;
  deploymentCount: number;
  leaseCount: number;
  cosmosSdkVersion: string;
  akashVersion: string;
  uptime7d: number;
  uptime: Array<ProviderSnapshot>;
  ipRegion: string;
  ipRegionCode: string;
  ipCountry: string;
  ipCountryCode: string;
  ipLat: string;
  ipLon: string;
  attributes: Array<{
    key: string;
    value: string;
    auditedBy: Array<string>;
  }>;
  isValidVersion: boolean;
}

export interface ProviderStatus {
  cluster: {
    leases: number;
    inventory: {
      error: string;
      active: Array<{
        cpu: number;
        gpu: number;
        memory: number;
        storage_ephemeral: number;
      }>;
      pending: Array<{
        cpu: number;
        gpu: number;
        memory: number;
        storage_ephemeral: number;
      }>;
      available: {
        nodes: Array<{
          cpu: number;
          gpu: number;
          memory: number;
          storage_ephemeral: number;
        }>;
      };
    };
  };
  bidengine: {
    orders: number;
  };
  manifest: {
    deployments: number;
  };
  cluster_public_hostname: string;
  address: string;
}

export interface ProviderVersion {
  akash: {
    version: string;
    commit: string;
    buildTags: string;
    go: string;
    cosmosSdkVersion: string;
  };
  kube: {
    major: string;
    minor: string;
    gitVersion: string;
    gitCommit: string;
    gitTreeState: string;
    buildDate: string;
    goVersion: string;
    compiler: string;
    platform: string;
  };
}

export interface ProviderStatusDto {
  name: string | null;
  orderCount: number;
  deploymentCount: number;
  leaseCount: number;
  error: string;
  active: Array<{
    cpu: number;
    gpu: number;
    memory: number;
    storage_ephemeral: number;
  }>;
  pending: Array<{
    cpu: number;
    gpu: number;
    memory: number;
    storage_ephemeral: number;
  }>;
  available: {
    nodes: Array<{
      cpu: number;
      gpu: number;
      memory: number;
      storage_ephemeral: number;
    }>;
  };
  akash: {
    version: string;
    commit: string;
    buildTags: string;
    go: string;
    cosmosSdkVersion: string;
  };
  kube: {
    major: string;
    minor: string;
    gitVersion: string;
    gitCommit: string;
    gitTreeState: string;
    buildDate: string;
    goVersion: string;
    compiler: string;
    platform: string;
  };
}

export type ProviderVerificationTier = "L0" | "L1" | "L2" | "L3" | "L4" | "unknown";

export type ProviderVerificationCapability =
  "unspecified" | "tee_hardware_attestation" | "confidential_computing" | "persistent_storage" | "bare_metal" | "unknown";

export interface ProviderVerificationCoin {
  denom: string;
  amount: string;
}

export interface ProviderVerificationListView {
  provider: string;
  moduleActive: boolean | null;
  summary: {
    effectiveTier: ProviderVerificationTier | null;
    validAuditorCount: number | null;
    capabilities: ProviderVerificationCapability[] | null;
    snapshotState: "unknown" | "not_posted" | "current" | "stale" | "suspended";
    maintenanceState: "unknown" | "none" | "scheduled" | "active";
    reviewState: "unknown" | "none" | "under_review" | "grace";
  };
  observedAt: string;
  observedHeight: string;
}

export interface ProviderVerificationView {
  provider: string;
  providerDeclaredTier: string | null;
  moduleActive: boolean | null;
  provenance: {
    providerTier: "provider self-declared";
    inventory: "provider-signed inventory";
    attestations: "auditor-attested";
  };
  summary: {
    bestAttestedTier: ProviderVerificationTier | null;
    effectiveTier: ProviderVerificationTier | null;
    capabilities: ProviderVerificationCapability[] | null;
    validAttestationCount: number | null;
    validAuditorCount: number | null;
    validAuditors: string[] | null;
    snapshotState: "unknown" | "not_posted" | "current" | "stale" | "suspended";
    maintenanceState: "unknown" | "none" | "scheduled" | "active";
    reviewState: "unknown" | "none" | "under_review" | "grace";
  };
  attestations: Array<{
    provider: string;
    auditor: string;
    tier: ProviderVerificationTier;
    capabilities: ProviderVerificationCapability[];
    evidenceHash: string | null;
    fee: ProviderVerificationCoin | null;
    feeStatus: "unspecified" | "escrowed" | "released_to_auditor" | "returned_to_provider" | "unknown";
    createdAt: string | null;
    expiresAt: string | null;
    status: "unspecified" | "valid" | "voided" | "expired" | "revoked" | "removed" | "unknown";
    voidedReason: "unspecified" | "discrepancy" | "governance" | "bond_withdrawn" | "bond_slashed" | "unknown";
    deposit: ProviderVerificationCoin | null;
    depositStatus: "unspecified" | "escrowed" | "pending_discrepancy" | "returned_to_auditor" | "slashed" | "unknown";
    auditEscrowId: string;
    faultAttribution: "unspecified" | "provider_fault" | "auditor_fault" | "shared_fault" | "no_fault" | "inconclusive" | "unknown";
  }>;
  bond: {
    provider: string;
    bondedAmount: ProviderVerificationCoin | null;
    requiredForCurrentTier: ProviderVerificationCoin;
    unbondingEntries: Array<{
      amount: ProviderVerificationCoin | null;
      completionTime: string | null;
    }>;
    slashed: boolean;
    lastSlashTime: string | null;
  } | null;
  snapshot: {
    provider: string;
    snapshotHash: string | null;
    resourceSummary: {
      totalGpus: number;
      totalVcpus: number;
      totalMemoryMb: string;
      totalStorageMb: string;
      activeLeases: number;
      softwareVersion: string;
      softwareSignature: string | null;
      softwareIdentity: {
        version: string;
        artifactRef: string;
        digestAlgorithm: string;
        digest: string | null;
        signatureType: string;
        signature: string | null;
        signatureRef: string;
        publicKeyRef: string;
      } | null;
    } | null;
    postedAt: string | null;
    snapshotTimestamp: string | null;
    complianceDeadline: string | null;
    suspended: boolean;
  } | null;
  grace: {
    id: string;
    provider: string;
    preservedTier: ProviderVerificationTier;
    sourceDiscrepancyIds: string[];
    startedAt: string | null;
    expiresAt: string | null;
    status: "unspecified" | "active" | "expired" | "terminated" | "unknown";
  } | null;
  auditEscrows: Array<{
    id: string;
    provider: string;
    consumedByAuditor: string | null;
    requestedTier: ProviderVerificationTier;
    requestedCapabilities: ProviderVerificationCapability[];
    fee: ProviderVerificationCoin | null;
    feeStatus: "unspecified" | "escrowed" | "released_to_auditor" | "returned_to_provider" | "unknown";
    providerDeposit: ProviderVerificationCoin | null;
    providerDepositStatus: "unspecified" | "escrowed" | "returned_to_provider" | "slashed" | "unknown";
    status: "unspecified" | "open" | "consumed" | "cancelled" | "expired" | "settled" | "unknown";
    openedAt: string | null;
    consumedAt: string | null;
    expiresAt: string | null;
    metadataHash: string | null;
    settlementReason: "unspecified" | "cancelled_unconsumed" | "expired_unconsumed" | "provider_fault" | "no_fault" | "unknown";
    faultAttribution: "unspecified" | "provider_fault" | "auditor_fault" | "shared_fault" | "no_fault" | "inconclusive" | "unknown";
  }>;
  maintenance: Array<{
    record: {
      id: string;
      provider: string;
      maintenanceType: "unspecified" | "planned" | "emergency" | "security" | "network" | "capacity" | "unknown";
      startsAt: string | null;
      expectedEndsAt: string | null;
      openedAt: string | null;
      closedAt: string | null;
      metadataHash: string | null;
    } | null;
    status: "unspecified" | "scheduled" | "active" | "elapsed" | "closed" | "unknown";
  }>;
  discrepancies: Array<{
    id: string;
    provider: string;
    auditorA: string;
    auditorATier: ProviderVerificationTier;
    auditorB: string;
    auditorBTier: ProviderVerificationTier;
    timestamp: string | null;
    resolutionStatus: "unspecified" | "pending" | "resolved" | "timed_out" | "unknown";
    resolutionProposalId: string;
    graceRecordId: string;
    resolutionReason:
      | "unspecified"
      | "auditor_a_correct"
      | "auditor_b_correct"
      | "both_auditors_wrong"
      | "provider_fault"
      | "shared_fault"
      | "evidence_inconclusive"
      | "governance_timeout_review"
      | "unknown";
    faultAttribution: "unspecified" | "provider_fault" | "auditor_fault" | "shared_fault" | "no_fault" | "inconclusive" | "unknown";
    resolutionEvidenceHash: string | null;
  }>;
  observedAt: string;
  observedHeight: string;
  completeness: {
    params: boolean;
    attestations: boolean;
    graces: boolean;
    snapshot: boolean;
    bond: boolean;
    auditEscrows: boolean;
    maintenance: boolean;
    discrepancies: boolean;
  };
}

export interface ApiProviderList {
  owner: string;
  name: string | null;
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
  lastOnlineDate: string;
  isAudited: boolean;
  gpuModels: { vendor: string; model: string; ram: string; interface: string }[];
  stats: {
    cpu: StatsItem;
    gpu: StatsItem;
    memory: StatsItem;
    storage: {
      ephemeral: StatsItem;
      persistent: StatsItem;
      total: StatsItem;
    };
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
  verification: ProviderVerificationListView | null;
}

export interface ClientProviderList extends ApiProviderList {
  userLeases?: number;
  userActiveLeases?: number;
}

export interface ApiProviderDetail extends Omit<ApiProviderList, "verification"> {
  verification: ProviderVerificationView | null;
  uptime: Array<{
    id: string;
    isOnline: boolean;
    checkDate: string;
  }>;
}

export interface ClientProviderDetail extends ApiProviderDetail {
  userLeases?: number;
  userActiveLeases?: number;
}

export type ClientProviderDetailWithStatus = ClientProviderDetail & ProviderStatusDto;

export type Auditor = {
  id: string;
  name: string;
  address: string;
  website: string;
};

export interface ApiProviderRegion {
  key: string;
  description: string;
  providers: string[];
}

export interface StatsItem {
  active: number;
  available: number;
  pending: number;
  total: number;
}
