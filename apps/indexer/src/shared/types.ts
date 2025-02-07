export type BlockType = {
  block_id: {
    hash: string;
    parts: {
      total: string;
      hash: string;
    };
  };
  block: {
    header: {
      version: {
        block: string;
      };
      chain_id: string;
      height: string;
      time: string;
      last_block_id: {
        hash: string;
        parts: {
          total: string;
          hash: string;
        };
      };
      last_commit_hash: string;
      data_hash: string;
      validators_hash: string;
      next_validators_hash: string;
      consensus_hash: string;
      app_hash: string;
      last_results_hash: string;
      evidence_hash: string;
      proposer_address: string;
    };
    data: {
      txs: string[];
    };
    evidence: {
      evidence: never[]; //?
    };
    last_commit: {
      height: string;
      round: number;
      block_id: {
        hash: string;
        parts: {
          total: string;
          hash: string;
        };
      };
      signatures: {
        block_id_flag: number;
        validator_address: string;
        timestamp: string;
        signature: string;
      }[];
    };
  };
};

export type BlockResultType = {
  height: string;
  txs_results: {
    code: number;
    data: string;
    log: string;
    info: string;
    gas_wanted: string;
    gas_used: string;
    events: EventType[];
    codespace: string;
  }[];
  begin_block_events?: EventType[];
  end_block_events?: EventType[];
  validator_updates: never; // ?
  consensus_param_updates: never; // ?
};

export type EventType = {
  type: string;
  attributes: {
    key: string;
    value: string | null;
    index: boolean;
  }[];
};
