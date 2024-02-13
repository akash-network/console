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
