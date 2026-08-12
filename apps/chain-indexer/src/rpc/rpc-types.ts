export interface RpcStatusResult {
  node_info: {
    network: string;
  };
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

/** Fields marshaled with proto3 omitempty semantics may be absent when zero (e.g. code 0 on success). */
export interface RpcTxResult {
  code?: number;
  log?: string;
  gas_used?: string;
  gas_wanted?: string;
}

export interface RpcBlockResultsResult {
  height: string;
  txs_results: RpcTxResult[] | null;
}

/** CometBFT `/genesis_chunked` response. `chunk`/`total` are marshaled as strings; `data` is base64-encoded genesis JSON. */
export interface RpcGenesisChunkResult {
  chunk: string | number;
  total: string | number;
  data: string;
}
