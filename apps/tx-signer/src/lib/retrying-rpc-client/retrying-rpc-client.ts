import { isRetriableError } from "@akashnetwork/http-sdk";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { RpcClient } from "@cosmjs/tendermint-rpc";
import type { RetryPolicy } from "cockatiel";
import { ExponentialBackoff, handleWhen, retry } from "cockatiel";

type ExecuteRequest = Parameters<RpcClient["execute"]>[0];
type ExecuteResponse = Awaited<ReturnType<RpcClient["execute"]>>;

const NON_IDEMPOTENT_METHODS = new Set(["broadcast_tx_async", "broadcast_tx_sync", "broadcast_tx_commit"]);

const BAD_STATUS_5XX_RE = /Bad status on response: 5\d{2}/;

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
    this.#executor = retry(handleWhen(error => this.#isRetriableTransportError(error)), {
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      backoff: new ExponentialBackoff({
        initialDelay: options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS,
        maxDelay: options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
      })
    });
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    this.#logger.debug({ event: "RPC_REQUEST", method: request.method });

    if (NON_IDEMPOTENT_METHODS.has(request.method)) {
      return this.rpcClient.execute(request);
    }

    try {
      return await this.#executor.execute(context => {
        if (context.attempt > 0) {
          this.#logger.warn({ event: "RPC_RETRY", method: request.method, attempt: context.attempt });
        }
        return this.rpcClient.execute(request);
      });
    } catch (error) {
      this.#logger.error({
        event: "RPC_REQUEST_FAILED",
        method: request.method,
        isRetriable: this.#isRetriableTransportError(error),
        error
      });
      throw error;
    }
  }

  disconnect(): void {
    this.rpcClient.disconnect();
  }

  #isRetriableTransportError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    if (BAD_STATUS_5XX_RE.test(error.message)) return true;
    if ("code" in error && isRetriableError(error as Error & { code: unknown })) return true;
    if ("cause" in error && error.cause instanceof Error && "code" in error.cause) {
      return isRetriableError(error.cause as Error & { code: unknown });
    }
    return false;
  }
}
