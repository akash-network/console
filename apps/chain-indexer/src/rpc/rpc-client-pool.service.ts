import { netConfig } from "@akashnetwork/net";
import { inject, singleton } from "tsyringe";
import { Agent } from "undici";

import type { EnvConfig } from "@src/config/env.config";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { LoggerService } from "@src/providers/logging.provider";
import type { RpcAbciQueryResult, RpcBlockResult, RpcBlockResultsResult, RpcGenesisChunkResult, RpcStatusResult } from "@src/rpc/rpc-types";

interface RpcNodeState {
  endpoint: string;
  inFlight: number;
  unhealthyUntil: number;
}

interface RpcEnvelope<T> {
  result?: T;
  error?: unknown;
}

@singleton()
export class RpcClientPool {
  readonly #nodes: RpcNodeState[];
  readonly #timeoutMs: number;
  readonly #cooldownMs: number;
  /**
   * AbortSignal.timeout only bounds the whole request. undici's default connect timeout is 10s and is
   * independent of that signal, which is too short for a loaded archival node.
   */
  readonly #dispatcher: Agent;
  readonly #logger: LoggerService;

  constructor(@inject(APP_CONFIG) config: EnvConfig, @inject(LoggerService) logger: LoggerService) {
    const endpoints = config.RPC_NODE_ENDPOINTS
      ? config.RPC_NODE_ENDPOINTS.split(",")
          .map(endpoint => endpoint.trim())
          .filter(Boolean)
      : netConfig.getAllBaseRpcUrls(config.NETWORK);

    if (endpoints.length === 0) {
      throw new Error(`No RPC endpoints available for network ${config.NETWORK}`);
    }

    this.#nodes = endpoints.map(endpoint => ({ endpoint: endpoint.replace(/\/$/, ""), inFlight: 0, unhealthyUntil: 0 }));
    this.#timeoutMs = config.RPC_TIMEOUT_MS;
    this.#cooldownMs = config.RPC_NODE_COOLDOWN_MS;
    this.#dispatcher = new Agent({ connectTimeout: this.#timeoutMs, headersTimeout: this.#timeoutMs, bodyTimeout: this.#timeoutMs });
    this.#logger = logger;
    this.#logger.setContext("RPC_POOL");
  }

  async getStatus(): Promise<RpcStatusResult> {
    return await this.#get<RpcStatusResult>("/status");
  }

  async getTipHeight(): Promise<number> {
    const status = await this.getStatus();
    return parseInt(status.sync_info.latest_block_height);
  }

  async getBlock(height: number): Promise<RpcBlockResult> {
    return await this.#get<RpcBlockResult>(`/block?height=${height}`);
  }

  async getBlockResults(height: number): Promise<RpcBlockResultsResult> {
    return await this.#get<RpcBlockResultsResult>(`/block_results?height=${height}`);
  }

  async getGenesisChunk(chunk: number): Promise<RpcGenesisChunkResult> {
    return await this.#get<RpcGenesisChunkResult>(`/genesis_chunked?chunk=${chunk}`);
  }

  /**
   * Runs an ABCI query against historical state at `height`. Reconciliation reads bank balances at the
   * indexer's checkpoint height (not the moving tip), which requires an unpruned node — sandbox is archival.
   */
  async abciQuery(path: string, dataHex: string, height: number): Promise<RpcAbciQueryResult["response"]> {
    const result = await this.#get<RpcAbciQueryResult>(
      `/abci_query?path=${encodeURIComponent(`"${path}"`)}&data=0x${dataHex}&height=${height}&prove=false`,
      result => {
        if (result.response.code) {
          throw new Error(`abci_query ${path} failed at height ${height}: ${result.response.log ?? `code ${result.response.code}`}`);
        }
      }
    );

    return result.response;
  }

  /**
   * A `validate` failure is treated like a transport failure so the failover loop tries the next node: a pruned
   * node answering HTTP 200 with a non-zero ABCI code (e.g. "height not available") must fail over to an archival one.
   */
  async #get<T>(path: string, validate?: (result: T) => void): Promise<T> {
    const errors: unknown[] = [];

    for (const node of this.#candidates()) {
      node.inFlight++;
      try {
        const result = await this.#fetchFromNode<T>(node.endpoint, path);
        validate?.(result);
        node.unhealthyUntil = 0;
        return result;
      } catch (error) {
        errors.push(error);
        node.unhealthyUntil = Date.now() + this.#cooldownMs;
        this.#logger.warn({ event: "RPC_NODE_FAILED", endpoint: node.endpoint, path, error });
      } finally {
        node.inFlight--;
      }
    }

    throw new AggregateError(errors, `All RPC nodes failed for ${path}`);
  }

  async #fetchFromNode<T>(endpoint: string, path: string): Promise<T> {
    const response = await fetch(`${endpoint}${path}`, { signal: AbortSignal.timeout(this.#timeoutMs), dispatcher: this.#dispatcher } as RequestInit);

    if (!response.ok) {
      throw new Error(`RPC responded with status ${response.status}`);
    }

    const envelope = (await response.json()) as RpcEnvelope<T>;

    if (envelope.error || envelope.result === undefined) {
      throw new Error(`RPC returned an error payload: ${JSON.stringify(envelope.error ?? "empty result")}`);
    }

    return envelope.result;
  }

  #candidates(): RpcNodeState[] {
    const now = Date.now();
    const healthy = this.#nodes.filter(node => node.unhealthyUntil <= now);
    const pool = healthy.length > 0 ? healthy : this.#nodes;
    return [...pool].sort((a, b) => a.inFlight - b.inFlight);
  }
}
