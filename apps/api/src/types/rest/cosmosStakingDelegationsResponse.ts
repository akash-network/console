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
