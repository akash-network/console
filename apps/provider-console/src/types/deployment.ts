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
    deployment_id: {
      owner: string;
      dseq: string;
    };
    state: string;
    version: string;
    created_at: string;
  };
  groups: Array<DeploymentGroup>;
  escrow_account: EscrowAccount;
}

type DeploymentGroup = DeploymentGroup_v2 | DeploymentGroup_v3;

interface DeploymentResource_V2 {
  cpu: {
    units: {
      val: string;
    };
    attributes: { key: string; value: string }[];
  };
  gpu: {
    units: {
      val: string;
    };
    attributes: { key: string; value: string }[];
  };
  memory: {
    quantity: {
      val: string;
    };
    attributes: { key: string; value: string }[];
  };
  storage: Array<{
    name: string;
    quantity: {
      val: string;
    };
    attributes: { key: string; value: string }[];
  }>;
  endpoints: Array<{
    kind: string;
    sequence_number: number;
  }>;
}
interface DeploymentResource_V3 extends DeploymentResource_V2 {}

interface DeploymentGroup_v2 {
  group_id: {
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
      resources: DeploymentResource_V2;
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
  group_id: {
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
      resource: DeploymentResource_V3;
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
  owner: string;
  state: string;
  balance: {
    denom: string;
    amount: string;
  };
  transferred: {
    denom: string;
    amount: string;
  };
  settled_at: string;
  depositor: string;
  funds: {
    denom: string;
    amount: string;
  };
}

export interface DeploymentDto {
  dseq: string;
  state: string;
  version: string;
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

export interface RpcLease {
  lease: {
    lease_id: {
      owner: string;
      dseq: string;
      gseq: number;
      oseq: number;
      provider: string;
    };
    state: string;
    price: {
      denom: string;
      amount: string;
    };
    created_at: string;
    closed_on: string;
  };
  escrow_payment: {
    account_id: {
      scope: string;
      xid: string;
    };
    payment_id: string;
    owner: string;
    state: string;
    rate: {
      denom: string;
      amount: string;
    };
    balance: {
      denom: string;
      amount: string;
    };
    withdrawn: {
      denom: string;
      amount: string;
    };
  };
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

export interface RpcBid {
  bid: {
    bid_id: {
      owner: string;
      dseq: string;
      gseq: number;
      oseq: number;
      provider: string;
    };
    state: string;
    price: {
      denom: string;
      amount: string;
    };
    created_at: string;
    resources_offer: Array<{
      resources: DeploymentResource_V3;
      count: number;
    }>;
  };
  escrow_account: {
    id: {
      scope: string;
      xid: string;
    };
    owner: string;
    state: string;
    balance: {
      denom: string;
      amount: string;
    };
    transferred: {
      denom: string;
      amount: string;
    };
    settled_at: string;
    depositor: string;
    funds: {
      denom: string;
      amount: string;
    };
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
