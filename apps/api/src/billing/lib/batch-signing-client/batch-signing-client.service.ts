import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { LoggerService } from "@akashnetwork/logging";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { Sema } from "async-sema";
import { ExponentialBackoff, handleWhenResult, retry } from "cockatiel";
import DataLoader from "dataloader";
import type { Result } from "ts-results";
import { Err, Ok } from "ts-results";

import type { SyncSigningStargateClient } from "@src/billing/lib/sync-signing-stargate-client/sync-signing-stargate-client";
import type { Wallet } from "@src/billing/lib/wallet/wallet";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { memoizeAsync } from "@src/caching/helpers";
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
 * Factory function type for creating a SyncSigningStargateClient.
 */
type CreateWithSignerFn = (endpoint: string, wallet: Wallet, options: { registry: Registry }) => SyncSigningStargateClient;

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
  private client: SyncSigningStargateClient;

  /**
   * Semaphore to ensure only one batch is processed at a time.
   */
  private readonly semaphore = new Sema(1);

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
   * Retry executor for transaction retrieval operations.
   *
   * Retries up to 5 times with exponential backoff when the transaction is not yet available (falsy result).
   * Uses a longer max delay (7 seconds) to account for blockchain confirmation times.
   */
  private readonly getTxExecutor = retry(
    handleWhenResult(res => !res),
    { maxAttempts: 5, backoff: new ExponentialBackoff({ maxDelay: 7_000, initialDelay: 500 }) }
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
  private readonly logger = LoggerService.forContext(this.loggerContext);

  /**
   * Checks if there are pending transactions waiting to be batched.
   *
   * @returns `true` if there are transactions waiting in the semaphore, `false` otherwise.
   */
  get hasPendingTransactions() {
    return this.semaphore.nrWaiting() > 0;
  }

  /**
   * Creates a new BatchSigningClientService instance.
   *
   * @param config - Service for accessing billing-related configuration.
   * @param wallet - The wallet used to sign transactions.
   * @param registry - Protocol buffer registry for encoding/decoding messages.
   * @param createClientWithSigner - Factory function to create a SyncSigningStargateClient.
   * @param chainErrorService - Service for converting chain errors to application errors.
   * @param loggerContext - Context name for logging (defaults to class name).
   */
  constructor(
    private readonly config: BillingConfigService,
    private readonly wallet: Wallet,
    private readonly registry: Registry,
    createClientWithSigner: CreateWithSignerFn,
    private readonly chainErrorService: ChainErrorService,
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
      throw await this.chainErrorService.toAppError(result.val as Error, messages);
    }

    const tx = await this.getTx(result.val);

    if (!tx) {
      const error = new Error("Failed to sign and broadcast transaction");
      this.logger.error({
        event: "SIGN_AND_BROADCAST_ERROR",
        error
      });
      throw error;
    }

    return tx;
  }

  /**
   * Disconnects the underlying blockchain client.
   *
   * This should be called when the service is no longer needed to clean up resources.
   */
  dispose() {
    this.client.disconnect();
  }

  /**
   * Processes a batch of sign and broadcast operations with semaphore locking to ensure sequential execution.
   *
   * @param inputs - Array of sign and broadcast batch options to process.
   * @returns Array of results, each containing either a transaction hash (Ok) or an error (Err).
   */
  private async signAndBroadcastBatchBlocking(inputs: readonly SignAndBroadcastBatchOptions[]): Promise<Result<string, unknown>[]> {
    await this.semaphore.acquire();
    try {
      return await this.executeAndBroadcastBatch(inputs);
    } finally {
      this.semaphore.release();
    }
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
    await this.client.connected();
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
   * Retrieves a transaction from the blockchain by hash.
   *
   * Retries with exponential backoff if the transaction is not yet available.
   *
   * @param hash - The transaction hash to look up.
   * @returns The indexed transaction, or `undefined` if not found after retries.
   */
  private async getTx(hash: string) {
    return await this.getTxExecutor.execute(() => this.client.getTx(hash));
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
