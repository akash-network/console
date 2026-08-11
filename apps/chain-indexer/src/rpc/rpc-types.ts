export interface RpcStatusResult {
  sync_info: {
    latest_block_height: string;
  };
}

export interface RpcBlockResult {
  block_id: {
    hash: string;
  };
  block: {
    header: {
      height: string;
      time: string;
      proposer_address: string;
      last_block_id?: {
        hash: string;
      };
    };
    data: {
      txs: string[];
    };
  };
}

export interface RpcTxResult {
  code: number;
  log?: string;
  gas_used: string;
  gas_wanted: string;
}

export interface RpcBlockResultsResult {
  height: string;
  txs_results: RpcTxResult[] | null;
}
