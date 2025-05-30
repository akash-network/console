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
