import type { Coin } from "@cosmjs/stargate";

export type Grant = {
  granter: string;
  grantee: string;
  authorization: {
    "@type": string;
    spend_limit: Coin;
  };
  expiration: string;
};

export type RestApiBalancesResponseType = {
  balances: Coin[];
  pagination: {
    next_key: string;
    total: string;
  };
};

export type RestApiAuthzGrantsResponseType = {
  grants: Grant[];
  pagination: {
    next_key: string;
    total: string;
  };
};

export type RestApiRewardsResponseType = {
  rewards: {
    reward: Coin[];
    validator_address: string;
  }[];
  total: Coin[];
};

export type RestApiRedelegationsResponseType = {
  redelegation_responses: {
    redelegation: {
      delegator_address: string;
      validator_src_address: string;
      validator_dst_address: string;
      entries: [
        {
          creation_height: string;
          completion_time: string;
          initial_balance: string;
          shares_dst: string;
        }
      ];
    };
    entries: [
      {
        redelegation_entry: {
          creation_height: string;
          completion_time: string;
          initial_balance: string;
          shares_dst: string;
        };
        balance: string;
      }
    ];
  }[];
  pagination: {
    next_key: string;
    total: string;
  };
};

export type RestApiUnbondingsResponseType = {
  unbonding_responses: [
    {
      delegator_address: string;
      validator_address: string;
      entries: [
        {
          creation_height: string;
          completion_time: string;
          initial_balance: string;
          balance: string;
        }
      ];
    }
  ];
  pagination: {
    next_key: string;
    total: string;
  };
};

export type RestApiDelegationsType = {
  delegation_responses: [
    {
      delegation: {
        delegator_address: string;
        validator_address: string;
        shares: string;
      };
      balance: Coin;
    }
  ];
  pagination: {
    next_key: string;
    total: string;
  };
};
