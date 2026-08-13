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

/** An ABCI event. Attribute keys/values may be base64-encoded depending on the CometBFT version, so callers normalize them. */
export interface RpcEvent {
  type: string;
  attributes: { key: string; value: string | null }[];
}

/** Fields marshaled with proto3 omitempty semantics may be absent when zero (e.g. code 0 on success). */
export interface RpcTxResult {
  code?: number;
  log?: string;
  gas_used?: string;
  gas_wanted?: string;
  events?: RpcEvent[];
}

export interface RpcBlockResultsResult {
  height: string;
  txs_results: RpcTxResult[] | null;
  finalize_block_events?: RpcEvent[];
  begin_block_events?: RpcEvent[];
  end_block_events?: RpcEvent[];
}

/** CometBFT `/abci_query` response. `value` is base64-encoded protobuf (or null when the queried key is absent). */
export interface RpcAbciQueryResult {
  response: {
    code?: number;
    log?: string;
    value: string | null;
    height?: string;
  };
}

/** CometBFT `/genesis_chunked` response. `chunk`/`total` are marshaled as strings; `data` is base64-encoded genesis JSON. */
export interface RpcGenesisChunkResult {
  chunk: string | number;
  total: string | number;
  data: string;
}
