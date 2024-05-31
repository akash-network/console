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
