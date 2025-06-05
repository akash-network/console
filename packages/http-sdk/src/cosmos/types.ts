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
