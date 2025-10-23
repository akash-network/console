import type {
  CommunityPoolSpendProposal,
  ParameterChangeProposal,
  SoftwareUpgradeProposal,
  TextProposal
} from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";

export interface IGenesis {
  app_state: {
    gov: {
      proposals: IGenesisProposal[];
    };
    staking: {
      validators: IGenesisValidator[];
    };
    genutil: {
      gen_txs: {
        body: {
          messages: any[];
        };
      }[];
    };
  };
}

export interface IGentxCreateValidator {
  "@type": "/cosmos.staking.v1beta1.MsgCreateValidator";
  description: {
    moniker: string;
    identity: string;
    website: string;
    security_contact: string;
    details: string;
  };
  commission: {
    rate: string;
    max_rate: string;
    max_change_rate: string;
  };
  min_self_delegation: string;
  delegator_address: string;
  validator_address: string;
  pubkey: {
    "@type": string;
    key: string;
  };
  value: {
    denom: string;
    amount: string;
  };
}

export interface IGenesisValidator {
  commission: {
    commission_rates: {
      max_change_rate: string;
      max_rate: string;
      rate: string;
    };
    update_time: string;
  };
  consensus_pubkey: {
    "@type": string;
    key: string;
  };
  delegate_shares: string;
  description: {
    details: string;
    identity: string;
    moniker: string;
    security_contact: string;
    website: string;
  };
  jailed: boolean;
  min_self_delegation: string;
  operator_address: string;
  status: string;
  tokens: string;
  unbonding_height: string;
  unbonding_time: string;
}

export interface IGenesisProposal {
  content: ParameterChangeProposal | SoftwareUpgradeProposal | CommunityPoolSpendProposal | TextProposal;
  deposit_end_time: string;
  final_tally_result: {
    abstain: string;
    no: string;
    no_with_veto: string;
    yes: string;
  };
  proposal_id: string;
  status: string;
  submit_time: string;
  total_deposit: {
    amount: string;
    denom: string;
  }[];
  voting_end_time: string;
  voting_start_time: string;
}
