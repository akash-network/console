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
export type CosmosGovProposalsResponse = {
  proposals: {
    proposal_id: string;
    content: {
      "@type": string;
      title: string;
      description: string;
      changes: {
        subspace: string;
        key: string;
        value: string;
      }[];
    };
    status: string;
    final_tally_result: {
      yes: string;
      abstain: string;
      no: string;
      no_with_veto: string;
    };
    submit_time: string;
    deposit_end_time: string;
    total_deposit: {
      denom: string;
      amount: string;
    }[];
    voting_start_time: string;
    voting_end_time: string;
  }[];
  pagination: {
    next_key: string | null;
    total: string;
  };
};

export type CosmosGovProposalResponse = {
  proposal: {
    proposal_id: string;
    content: {
      "@type": string;
      title: string;
      description: string;
      changes: {
        subspace: string;
        key: string;
        value: string;
      }[];
    };
    status: string;
    final_tally_result?: {
      yes: string;
      abstain: string;
      no: string;
      no_with_veto: string;
    };
    submit_time: string;
    deposit_end_time: string;
    total_deposit: {
      denom: string;
      amount: string;
    }[];
    voting_start_time: string;
    voting_end_time: string;
  };
};

export type RestGovProposalsTallyResponse = {
  tally: {
    yes: string;
    abstain: string;
    no: string;
    no_with_veto: string;
  };
};
