import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { isRetriableError } from "@akashnetwork/http-sdk";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import type { SigningStargateClient } from "@cosmjs/stargate";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { ExponentialBackoff, handleWhenResult, retry } from "cockatiel";
import DataLoader from "dataloader";
import type { Result } from "ts-results";
import { Err, Ok } from "ts-results";

import type { CreateSigningStargateClient } from "@src/billing/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import type { Wallet } from "@src/billing/lib/wallet/wallet";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { memoizeAsync } from "@src/caching/helpers";
import type { Semaphore } from "@src/core/lib/pg-semaphore";
import { SemaphoreFactory } from "@src/core/lib/pg-semaphore";
import { withSpan } from "@src/core/services/tracing/tracing.service";

/**
 * Options for signing and broadcasting a transaction.
 */
export interface SignAndBroadcastOptions {
  /**
   * Fee configuration for the transaction.
   */
  fee: {
    /**
     * Address of the fee granter (account that pays for transaction fees).
     */
    granter: string;
  };
}

/**
 * Input structure for batch sign and broadcast operations.
 */
interface SignAndBroadcastBatchOptions {
  /**
   * The messages to include in the transaction.
   */
  messages: readonly EncodeObject[];
  /**
   * Optional execution options (e.g., fee granter).
   */
  options?: SignAndBroadcastOptions;
}

/**
 * Service for batching and executing multiple blockchain transactions efficiently.
 *
 * This service batches multiple transaction requests and executes them sequentially
 * to ensure proper sequence number management and prevent sequence mismatches.
 * Transactions are signed locally and then broadcast to the blockchain network.
 */
export class BatchSigningClientService {
  /**
   * The denomination for transaction fees (uakt = micro AKT).
   */
  private readonly FEES_DENOM = "uakt";

  /**
   * The signing client used to interact with the blockchain.
   */
  private client: SigningStargateClient;

  /**
   * Cached semaphore instance, initialized lazily by wallet address.
   * Uses PostgreSQL advisory locks for distributed coordination across instances.
   */
  private semaphore: Semaphore | null = null;

  /**
   * Lazily initializes and returns the semaphore keyed by wallet address.
   */
  private readonly getSemaphore = memoizeAsync(async () => {
    const address = await this.wallet.getFirstAddress();
    this.semaphore = SemaphoreFactory.create(`BatchSigningClientService:${address}`);
    return this.semaphore;
  });

  /**
   * DataLoader instance that batches transaction requests and schedules execution.
   * Requests are collected for WALLET_BATCHING_INTERVAL_MS before being processed as a batch.
   */
  private signAndBroadcastLoader = new DataLoader(
    async (batchedInputs: readonly SignAndBroadcastBatchOptions[]) => {
      return this.signAndBroadcastBatchBlocking(batchedInputs);
    },
    { cache: false, batchScheduleFn: callback => setTimeout(callback, this.config.get("WALLET_BATCHING_INTERVAL_MS")) }
  );

  /**
   * Retry executor for sign and broadcast operations.
   *
   * Retries up to 5 times with exponential backoff when account sequence mismatch errors occur.
   * The retry strategy detects errors containing "account sequence mismatch" in the message.
   */
  private readonly signAndBroadcastExecutor = retry(
    handleWhenResult(res => res instanceof Err && "message" in res.val && res.val.message?.includes("account sequence mismatch")),
    { maxAttempts: 5, backoff: new ExponentialBackoff({ maxDelay: 5_000, initialDelay: 500 }) }
  );

  /**
   * Retry executor for transaction recovery.
   *
   * Retries up to 5 times with exponential backoff when:
   * - The transaction is not found (null result)
   * - Network errors occur during transaction retrieval
   *
   * This handles cases where the transaction may have been included in a block
   * but is not yet indexed, or when the RPC connection fails.
   */
  private readonly txRecoveryExecutor = retry(
    handleWhenResult(res => !res).orWhen(err => this.isRetriableNetworkError(err)),
    {
      maxAttempts: 5,
      backoff: new ExponentialBackoff({ maxDelay: 10_000, initialDelay: 1_000 })
    }
  );

  /**
   * Memoized async function that retrieves and caches the chain ID.
   *
   * The first call fetches the chain ID from the client, and subsequent calls
   * return the cached value without making additional client calls.
   *
   * @returns A promise that resolves to the chain ID string.
   */
  private readonly getChainId = memoizeAsync(() => this.client.getChainId());

  /**
   * Memoized async function that retrieves and caches the wallet address.
   *
   * The first call fetches the address from the wallet, and subsequent calls
   * return the cached value without making additional wallet operations.
   *
   * @returns A promise that resolves to the wallet address string.
   */
  private readonly getAddress = memoizeAsync(() => this.wallet.getFirstAddress());

  /**
   * Logger instance for this service.
   */
  private readonly logger = createOtelLogger({ context: this.loggerContext });

  /**
   * Checks if there are pending transactions waiting to be batched.
   *
   * @returns `true` if there are transactions waiting in the semaphore, `false` otherwise.
   */
  get hasPendingTransactions() {
    return (this.semaphore?.nrInFlight() ?? 0) > 0;
  }

  /**
   * Creates a new BatchSigningClientService instance.
   *
   * @param config - Service for accessing billing-related configuration.
   * @param wallet - The wallet used to sign transactions.
   * @param registry - Protocol buffer registry for encoding/decoding messages.
   * @param createClientWithSigner - Factory function to create a SyncSigningStargateClient.
   * @param loggerContext - Context name for logging (defaults to class name).
   */
  constructor(
    private readonly config: BillingConfigService,
    private readonly wallet: Wallet,
    private readonly registry: Registry,
    createClientWithSigner: CreateSigningStargateClient,
    private readonly loggerContext = BatchSigningClientService.name
  ) {
    this.client = createClientWithSigner(this.config.get("RPC_NODE_ENDPOINT"), this.wallet, {
      registry: this.registry
    });
  }

  /**
   * Signs and broadcasts a transaction to the blockchain.
   *
   * This method adds the transaction to a batch queue. Multiple transactions
   * are collected and executed together for efficiency. The method retries
   * on sequence mismatch errors with exponential backoff.
   *
   * If a network error occurs during transaction retrieval, the method will
   * attempt to recover by re-querying the transaction after a brief delay.
   *
   * @param messages - The protocol buffer messages to include in the transaction.
   * @param options - Optional execution options (e.g., fee granter).
   * @returns The indexed transaction result after successful broadcast.
   * @throws If the transaction fails to sign, broadcast, or cannot be retrieved.
   */
  async signAndBroadcast(messages: readonly EncodeObject[], options?: SignAndBroadcastOptions): Promise<IndexedTx> {
    this.logger.debug({
      event: "SIGN_AND_BROADCAST_BEGIN",
      messageTypes: messages.map(m => m.typeUrl),
      granter: options?.fee?.granter
    });

    const result = await this.signAndBroadcastExecutor.execute(context => {
      this.logger.debug({ event: "SIGN_AND_BROADCAST_ATTEMPT", attempt: context.attempt });
      return this.signAndBroadcastLoader.load({ messages, options });
    });

    if (!result.ok) {
      this.logger.debug({
        event: "SIGN_AND_BROADCAST_ERROR",
        error: result.val
      });
      throw result.val;
    }

    const txHash = result.val;

    const tx = await this.tryRecoverTransaction(txHash);

    if (!tx) {
      const error = new Error("Failed to sign and broadcast transaction");
      this.logger.error({
        event: "SIGN_AND_BROADCAST_TX_NOT_FOUND",
        txHash,
        error
      });
      throw error;
    }

    this.logger.debug({
      event: "SIGN_AND_BROADCAST_SUCCESS",
      txHash,
      height: tx.height
    });

    return tx;
  }

  /**
   * Processes a batch of sign and broadcast operations with semaphore locking to ensure sequential execution.
   *
   * @param inputs - Array of sign and broadcast batch options to process.
   * @returns Array of results, each containing either a transaction hash (Ok) or an error (Err).
   */
  private async signAndBroadcastBatchBlocking(inputs: readonly SignAndBroadcastBatchOptions[]): Promise<Result<string, unknown>[]> {
    const semaphore = await this.getSemaphore();
    return semaphore.withLock(() => this.executeAndBroadcastBatch(inputs));
  }

  /**
   * Signs and broadcasts a batch of transactions.
   *
   * This is wrapped in a tracing span for observability.
   *
   * @param inputs - Array of sign and broadcast batch options to process.
   * @returns Array of results, each containing either a transaction hash (Ok) or an error (Err).
   */
  private async executeAndBroadcastBatch(inputs: readonly SignAndBroadcastBatchOptions[]): Promise<Result<string, unknown>[]> {
    return await withSpan("BatchSigningClientService.executeTxBatch", async () => {
      const signResults = await this.signBatch(inputs);
      return await this.broadcastBatch(signResults);
    });
  }

  /**
   * Signs a batch of transactions sequentially.
   *
   * Transactions are signed one at a time to ensure proper sequence number management.
   * The sequence number is only incremented when a transaction is successfully signed,
   * preventing sequence gaps that could cause chain errors.
   *
   * @param inputs - Array of sign and broadcast batch options to sign.
   * @returns Array of results, each containing either a signed transaction (Ok) or an error (Err).
   */
  private async signBatch(inputs: readonly SignAndBroadcastBatchOptions[]): Promise<Result<TxRaw, unknown>[]> {
    const [address, chainId] = await Promise.all([this.getAddress(), this.getChainId()]);
    const accountInfo = await this.client.getAccount(address);

    if (!accountInfo) {
      throw new Error("Failed to get account info");
    }

    const results: Result<TxRaw, unknown>[] = [];
    let currentSequence = accountInfo.sequence;

    for (const input of inputs) {
      try {
        const { messages, options } = input;
        const fee = await this.estimateFee(messages, this.FEES_DENOM, options?.fee?.granter);

        const signedTx = await this.client.sign(accountInfo.address, messages, fee, "", {
          accountNumber: accountInfo.accountNumber,
          sequence: currentSequence,
          chainId
        });

        results.push(Ok(signedTx));
        currentSequence++;
      } catch (error: unknown) {
        results.push(Err(error));
      }
    }

    return results;
  }

  /**
   * Broadcasts a batch of signed transactions to the blockchain.
   *
   * Transactions are broadcast sequentially. All but the last transaction use
   * `broadcastTxSync` for faster submission, while the last transaction uses
   * `broadcastTx` to wait for confirmation. If a transaction already exists in
   * the cache, its hash is computed and returned without error.
   *
   * @param signResults - Array of signing results from `signBatch`.
   * @returns Array of results, each containing either a transaction hash (Ok) or an error (Err).
   */
  private async broadcastBatch(signResults: Result<TxRaw, unknown>[]): Promise<Result<string, unknown>[]> {
    const results: Result<string, unknown>[] = [];
    let index = 0;

    while (index < signResults.length) {
      const signResult = signResults[index];

      if (!signResult.ok) {
        results.push(signResult);
        index++;
        continue;
      }

      const txBytes = TxRaw.encode(signResult.val).finish();

      try {
        if (index < signResults.length - 1) {
          const response = await this.client.broadcastTxSync(txBytes);
          results.push(Ok(response));
        } else {
          const lastDelivery = await this.client.broadcastTx(txBytes);
          results.push(Ok(lastDelivery.transactionHash));
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message.toLowerCase().includes("tx already exists in cache")) {
          const txHash = toHex(sha256(txBytes));
          results.push(Ok(txHash));
        } else {
          results.push(Err(error));
        }
      }

      index++;
    }

    return results;
  }

  /**
   * Checks if an error is a retriable network error.
   *
   * Network errors can occur when the RPC connection is interrupted, but the
   * transaction may have already been successfully included in a block.
   * Cosmjs wraps network errors in a "fetch failed" error with the actual
   * error in the `.cause` property.
   *
   * @param error - The error to check.
   * @returns `true` if the error is a retriable network error.
   */
  private isRetriableNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    if ("code" in error) {
      return isRetriableError(error as Error & { code: unknown });
    }

    // Cosmjs wraps network errors in "fetch failed" with the actual error in .cause
    if ("cause" in error && error.cause instanceof Error && "code" in error.cause) {
      return isRetriableError(error.cause as Error & { code: unknown });
    }

    return false;
  }

  /**
   * Attempts to retrieve a transaction with retry logic for both network errors
   * and cases where the transaction is not yet indexed.
   *
   * This handles cases where:
   * - The transaction was broadcast but is not yet indexed
   * - Network errors occur during retrieval
   *
   * @param hash - The transaction hash to retrieve.
   * @returns The indexed transaction if found, or `null` if not found after retries.
   */
  private async tryRecoverTransaction(hash: string): Promise<IndexedTx | null> {
    try {
      return await this.txRecoveryExecutor.execute(context => {
        this.logger.debug({ event: "TX_RECOVERY_ATTEMPT", txHash: hash, attempt: context.attempt });
        return this.client.getTx(hash);
      });
    } catch (error) {
      if (this.isRetriableNetworkError(error)) {
        this.logger.warn({ event: "TX_RECOVERY_FAILED", txHash: hash, error });
        return null;
      }
      throw error;
    }
  }

  /**
   * Estimates the fee required for a transaction by simulating it.
   *
   * The estimated gas is multiplied by a safety multiplier to account for
   * potential variability. If a granter is specified, the fee structure
   * includes the granter address.
   *
   * @param messages - The messages to simulate.
   * @param denom - The denomination for the fee (e.g., "uakt").
   * @param granter - Optional address of the fee granter.
   * @returns The calculated fee structure.
   */
  private async estimateFee(messages: readonly EncodeObject[], denom: string, granter?: string) {
    const gasEstimation = await this.client.simulate(await this.getAddress(), messages, "");
    const estimatedGas = Math.ceil(gasEstimation * this.config.get("GAS_SAFETY_MULTIPLIER"));

    const fee = calculateFee(estimatedGas, GasPrice.fromString(`${this.config.get("AVERAGE_GAS_PRICE")}${denom}`));

    return granter ? { ...fee, granter } : fee;
  }
}
