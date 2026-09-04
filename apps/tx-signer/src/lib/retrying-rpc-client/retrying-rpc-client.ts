import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { RpcClient } from "@cosmjs/tendermint-rpc";
import type { RetryPolicy } from "cockatiel";
import { ExponentialBackoff, handleWhen, retry } from "cockatiel";

import { isRetriableTransportError } from "../retriable-transport-error/retriable-transport-error";

type ExecuteRequest = Parameters<RpcClient["execute"]>[0];
type ExecuteResponse = Awaited<ReturnType<RpcClient["execute"]>>;

const NON_IDEMPOTENT_METHODS = new Set(["broadcast_tx_async", "broadcast_tx_sync", "broadcast_tx_commit"]);

const ABCI_QUERY_METHOD = "abci_query";

/** The simulate query carries a whole tx, `timeoutTimestamp` included, so replaying its bytes can only ever expire. */
const SIMULATE_ABCI_QUERY_PATH = "/cosmos.tx.v1beta1.Service/Simulate";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 2_000;

export interface RetryingRpcClientOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export class RetryingRpcClient implements RpcClient {
  readonly #logger = createOtelLogger({ context: RetryingRpcClient.name });

  readonly rpcClient: RpcClient;

  readonly #executor: RetryPolicy;

  constructor(rpcClient: RpcClient, options: RetryingRpcClientOptions = {}) {
    this.rpcClient = rpcClient;
    this.#executor = retry(handleWhen(isRetriableTransportError), {
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      backoff: new ExponentialBackoff({
        initialDelay: options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS,
        maxDelay: options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
      })
    });
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    this.#logger.debug({ event: "RPC_REQUEST", method: request.method });

    if (this.#isReplayUnsafe(request)) {
      return await this.#executeOnce(request);
    }

    try {
      return await this.#executor.execute(context => {
        if (context.attempt > 0) {
          this.#logger.warn({ event: "RPC_RETRY", method: request.method, attempt: context.attempt });
        }
        return this.rpcClient.execute(request);
      });
    } catch (error) {
      this.#logFailure(request, error);
      throw error;
    }
  }

  disconnect(): void {
    this.rpcClient.disconnect();
  }

  async #executeOnce(request: ExecuteRequest): Promise<ExecuteResponse> {
    try {
      return await this.rpcClient.execute(request);
    } catch (error) {
      this.#logFailure(request, error);
      throw error;
    }
  }

  #logFailure(request: ExecuteRequest, error: unknown): void {
    this.#logger.error({
      event: "RPC_REQUEST_FAILED",
      method: request.method,
      isRetriable: isRetriableTransportError(error),
      error
    });
  }

  /**
   * A request the transport must not replay: either it is not idempotent, or its payload embeds its own validity
   * window, which only the layer that can rebuild that payload is allowed to retry.
   */
  #isReplayUnsafe(request: ExecuteRequest): boolean {
    if (NON_IDEMPOTENT_METHODS.has(request.method)) return true;
    if (request.method !== ABCI_QUERY_METHOD) return false;

    const { params } = request;
    return "path" in params && params.path === SIMULATE_ABCI_QUERY_PATH;
  }
}
