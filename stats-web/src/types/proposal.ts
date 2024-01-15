import { IValidatorAddess } from "./validator";

export interface ProposalSummary {
  id: number;
  title: string;
  status: string;
  submitTime: string;
  votingStartTime: string;
  votingEndTime: string;
  totalDeposit: number;
}

export interface ProposalDetail {
  id: number;
  title: string;
  proposer: IValidatorAddess;
  description: string;
  status: string;
  submitTime: string;
  votingStartTime: string;
  votingEndTime: string;
  totalDeposit: number;
  tally: {
    yes: number;
    abstain: number;
    no: number;
    noWithVeto: number;
    total: number;
  };
  paramChanges: {
    subspace: string;
    key: string;
    value: any;
  }[];
}
