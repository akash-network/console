import type { DeploymentReclamation } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { paths } from "@akashnetwork/console-api-types";
import type { Bid, DeploymentResource } from "@akashnetwork/http-sdk";

export type RpcBid = Bid;
export type { DeploymentResource };
export type { RpcLease } from "@akashnetwork/http-sdk";

export interface DeploymentDetail {
  owner: string;
  dseq: string;
  balance: number;
  status: string;
  denom: string;
  totalMonthlyCostUDenom: number;
  leases: {
    oseq: number;
    gseq: number;
    status: string;
    monthlyCostUDenom: number;
    cpuUnits: number;
    gpuUnits: number;
    memoryQuantity: number;
    storageQuantity: number;
    provider: {
      address: string;
      hostUri: string;
      isDeleted: boolean;
      attributes: {
        key: string;
        value: string;
      }[];
    };
  }[];
  events: {
    txHash: string;
    date: string;
    type: string;
  }[];
}

export interface DeploymentSummary {
  owner: string;
  dseq: string;
  status: string;
  createdHeight: number;
  cpuUnits: number;
  gpuUnits: number;
  memoryQuantity: number;
  storageQuantity: number;
}

export interface RpcDeployment {
  deployment: {
    id: {
      owner: string;
      dseq: string;
    };
    state: string;
    hash: string;
    created_at: string;
  };
  groups: Array<DeploymentGroup>;
  escrow_account: EscrowAccount;
}

export type DeploymentGroup = DeploymentGroup_v2 | DeploymentGroup_v3;

export type DeploymentResource_V2 = DeploymentResource;
export type DeploymentResource_V3 = DeploymentResource;

interface DeploymentGroup_v2 {
  id: {
    owner: string;
    dseq: string;
    gseq: number;
  };
  state: string;
  group_spec: {
    name: string;
    requirements: {
      signed_by: {
        all_of: string[];
        any_of: string[];
      };
      attributes: Array<{
        key: string;
        value: string;
      }>;
    };
    resources: Array<{
      resource: {
        id: number;
        cpu: {
          units: {
            val: string;
          };
          attributes: Array<{
            key: string;
            value: string;
          }>;
        };
        memory: {
          quantity: {
            val: string;
          };
          attributes: Array<{
            key: string;
            value: string;
          }>;
        };
        storage: Array<{
          name: string;
          quantity: {
            val: string;
          };
          attributes: Array<{
            key: string;
            value: string;
          }>;
        }>;
        gpu: {
          units: {
            val: string;
          };
          attributes: Array<{
            key: string;
            value: string;
          }>;
        };
        endpoints: Array<{
          kind: string;
          sequence_number: number;
        }>;
      };
      count: number;
      price: {
        denom: string;
        amount: string;
      };
    }>;
  };
  created_at: string;
}

interface DeploymentGroup_v3 {
  id: {
    owner: string;
    dseq: string;
    gseq: number;
  };
  state: string;
  group_spec: {
    name: string;
    requirements: {
      signed_by: {
        all_of: string[];
        any_of: string[];
      };
      attributes: Array<{
        key: string;
        value: string;
      }>;
    };
    resources: Array<{
      resource: {
        id: number;
        cpu: {
          units: {
            val: string;
          };
          attributes: Array<{
            key: string;
            value: string;
          }>;
        };
        memory: {
          quantity: {
            val: string;
          };
          attributes: Array<{
            key: string;
            value: string;
          }>;
        };
        storage: Array<{
          name: string;
          quantity: {
            val: string;
          };
          attributes: Array<{
            key: string;
            value: string;
          }>;
        }>;
        gpu: {
          units: {
            val: string;
          };
          attributes: Array<{
            key: string;
            value: string;
          }>;
        };
        endpoints: Array<{
          kind: string;
          sequence_number: number;
        }>;
      };
      count: number;
      price: {
        denom: string;
        amount: string;
      };
    }>;
  };
  created_at: string;
}

interface EscrowAccount {
  id: {
    scope: string;
    xid: string;
  };
  state: {
    owner: string;
    state: string;
    transferred: Array<{
      denom: string;
      amount: string;
    }>;
    settled_at: string;
    funds: Array<{
      denom: string;
      amount: string;
    }>;
    deposits: Array<{
      owner: string;
      height: string;
      source: string;
      balance: {
        denom: string;
        amount: string;
      };
    }>;
  };
}

export interface DeploymentDto {
  dseq: string;
  state: string;
  hash: string;
  denom: string;
  createdAt: number;
  escrowBalance: number;
  transferred: {
    denom: string;
    amount: string;
  };
  cpuAmount: number;
  gpuAmount?: number;
  memoryAmount: number;
  storageAmount: number;
  escrowAccount: EscrowAccount;
  groups: Array<DeploymentGroup>;
}

export type ListDeploymentsItem = paths["/v1/deployments"]["get"]["responses"][200]["content"]["application/json"]["data"]["deployments"][number];

/** What the console observed running inside a lease's containers, as distinct from the model its group requested on chain. */
export type DetectedLeaseGpus = NonNullable<ListDeploymentsItem["leases"][number]["detectedGpus"]>;

/** What the provider offered for a lease in the bid it was created from, which is what an `Any model` request resolves to. */
export type OfferedLeaseGpus = NonNullable<ListDeploymentsItem["leases"][number]["offeredGpus"]>;

export type LeaseGpus = Pick<LeaseDto, "detectedGpus" | "offeredGpus">;

/** Keyed `gseq/oseq/provider`, the only identity a chain lease and a console lease share. */
export type LeaseGpusByLease = Partial<Record<string, LeaseGpus>>;

/** What the console records about a deployment, as a list shows it. Absent for one the console holds no record of. */
export type ListedDeploymentSettings = ListDeploymentsItem["settings"];

/** The name is null for a deployment created before the console recorded names, which rows render as the dseq. */
export interface ListedDeploymentDto extends DeploymentDto {
  name: string | null;
  /** Inline where the list came from the console API. The chain-backed list leaves each row to fetch its own. */
  leases?: LeaseDto[];
  settings?: ListedDeploymentSettings;
}

export type DeploymentStatus = "active" | "closed";

export interface LeaseDto {
  id: string;
  owner: string;
  provider: string;
  dseq: string;
  gseq: number;
  oseq: number;
  state: string;
  price: {
    denom: string;
    amount: string;
  };
  cpuAmount: number;
  gpuAmount?: number;
  memoryAmount: number;
  storageAmount: number;
  // Optional: leaseToDto leaves it undefined when no group matches the lease's gseq.
  group?: DeploymentGroup;
  /** Present only where the console has looked inside and found a gpu; absent is "not looked", never "no gpu". */
  detectedGpus?: DetectedLeaseGpus;
  /** Present only where the console recorded the lease's bid; absent is "not recorded", never "no gpu". */
  offeredGpus?: OfferedLeaseGpus;
  reason?: string;
  closedOn?: string;
  reclamation?: {
    deadline?: number;
    reason?: string;
    startedAt?: string;
    window?: string;
  };
}

export interface BidDto {
  id: string;
  owner: string;
  provider: string;
  dseq: string;
  gseq: number;
  oseq: number;
  price: {
    denom: string;
    amount: string;
  };
  state: string;
  resourcesOffer: Array<{
    resources: DeploymentResource_V3;
    count: number;
  }>;
  // Reclamation window the provider offers for this bid (AEP-82), as a REST Duration string e.g. "86400s".
  // Undefined on pre-v2.1 bids or when the provider offers no reclamation.
  reclamationWindow?: string;
}

export interface RpcDepositParams {
  param: {
    subspace: string;
    key: string;
    // Array of { denom: string, amount: string }
    value: string;
  };
}

export interface RpcDeploymentParams {
  params: {
    min_deposits: DepositParams[];
  };
}

export interface DepositParams {
  denom: string;
  amount: string;
}

export interface NewDeploymentData {
  sdl: unknown;
  manifest: unknown;
  groups: GroupSpec[];
  deploymentId: {
    owner: string;
    dseq: string;
  };
  orderId: unknown[];
  leaseId: unknown[];
  deposit: DepositParams;
  hash: Uint8Array;
  reclamation?: DeploymentReclamation;
}
