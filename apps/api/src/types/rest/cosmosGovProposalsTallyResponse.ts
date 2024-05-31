export type RestGovProposalsTallyResponse = {
  tally: {
    yes: string;
    abstain: string;
    no: string;
    no_with_veto: string;
  };
};
