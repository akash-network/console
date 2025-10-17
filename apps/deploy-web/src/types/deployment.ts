import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
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

export interface NamedDeploymentDto extends DeploymentDto {
  name: string;
}

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
  group: DeploymentGroup;
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
}

export interface RpcDepositParams {
  param: {
    subspace: string;
    key: string;
    // Array of { denom: string, amount: string }
    value: string;
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
}
