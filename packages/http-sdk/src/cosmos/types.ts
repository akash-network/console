export type CosmosStakingPoolResponse = {
  pool: {
    not_bonded_tokens: string;
    bonded_tokens: string;
  };
};

export type CosmosBankSupplyResponse = {
  supply: {
    denom: string;
    amount: string;
  }[];
  pagination: {
    next_key: string | null;
    total: string;
  };
};

export type CosmosDistributionCommunityPoolResponse = {
  pool: Array<{
    denom: string;
    amount: string;
  }>;
};

export type CosmosMintInflationResponse = {
  inflation: string;
};

export type CosmosDistributionParamsResponse = {
  params: {
    community_tax: string;
  };
};

export type RestCosmosStakingValidatorResponse = {
  validator: {
    operator_address: string;
    consensus_pubkey: {
      "@type": string;
      key: string;
    };
    jailed: boolean;
    status: number;
    tokens: string;
    delegator_shares: string;
    description: {
      moniker: string;
      identity: string;
      website: string;
      security_contact: string;
      details: string;
    };
    unbonding_height: string;
    unbonding_time: string;
    commission: {
      commission_rates: {
        rate: string;
        max_rate: string;
        max_change_rate: string;
      };
      update_time: string;
    };
    min_self_delegation: string;
  };
};

export type RestCosmosStakingValidatorListResponse = {
  validators: RestCosmosStakingValidatorResponse["validator"][];
  pagination: {
    next_key: string;
    total: string;
  };
};

export type RestCosmosBankBalancesResponse = {
  balances: {
    denom: string;
    amount: string;
  }[];
  pagination: {
    next_key: string | null;
    total: number;
  };
};

export type RestCosmosStakingDelegationsResponse = {
  delegation_responses: {
    delegation: {
      delegator_address: string;
      validator_address: string;
      shares: string;
    };
    balance: {
      denom: string;
      amount: string;
    };
  }[];
  pagination: {
    next_key: string | null;
    total: number;
  };
};

export type RestCosmosDistributionDelegatorsRewardsResponse = {
  rewards: {
    validator_address: string;
    reward: {
      denom: string;
      amount: string;
    }[];
  }[];
  total: {
    denom: string;
    amount: string;
  }[];
};

export type RestCosmosStakingDelegatorsRedelegationsResponse = {
  redelegation_responses: {
    redelegation: {
      delegator_address: string;
      validator_src_address: string;
      validator_dst_address: string;
      entries: null;
    };
    entries: {
      redelegation_entry: {
        creation_height: number;
        completion_time: string;
        initial_balance: string;
        shares_dst: string;
      };
      balance: string;
    }[];
  }[];
  pagination: {
    next_key: string | null;
    total: string;
  };
};

export type CosmosDistributionValidatorsCommissionResponse = {
  commission: {
    commission: { denom: string; amount: string }[];
  };
};
