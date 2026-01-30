import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { isRetriableError } from "@akashnetwork/http-sdk";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import type { SigningStargateClient } from "@cosmjs/stargate";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { Sema } from "async-sema";
import { ExponentialBackoff, handleWhenResult, retry } from "cockatiel";
import DataLoader from "dataloader";
import type { Result } from "ts-results";
import { Err, Ok } from "ts-results";

import type { AppConfigService } from "@src/services/app-config/app-config.service";
import { memoizeAsync } from "../../caching/helpers/helpers";
import { withSpan } from "../../services/tracing/tracing.service";
import type { CreateSigningStargateClient } from "../signing-stargate-client-factory/signing-stargate-client.factory";
import type { Wallet } from "../wallet/wallet";

export interface SignAndBroadcastOptions {
  fee: {
    granter: string;
  };
}

interface SignAndBroadcastBatchOptions {
  messages: readonly EncodeObject[];
  options?: SignAndBroadcastOptions;
}

export class BatchSigningClientService {
  private readonly FEES_DENOM = "uakt";

  private client: SigningStargateClient;

  private readonly semaphore = new Sema(1);

  private activeBatches = 0;

  private signAndBroadcastLoader = new DataLoader(
    async (batchedInputs: readonly SignAndBroadcastBatchOptions[]) => {
      return this.signAndBroadcastBatchBlocking(batchedInputs);
    },
    { cache: false, batchScheduleFn: callback => setTimeout(callback, this.config.get("WALLET_BATCHING_INTERVAL_MS")) }
  );

  private readonly signAndBroadcastExecutor = retry(
    handleWhenResult(res => res instanceof Err && "message" in res.val && res.val.message?.includes("account sequence mismatch")),
    { maxAttempts: 5, backoff: new ExponentialBackoff({ maxDelay: 5_000, initialDelay: 500 }) }
  );

  private readonly txRecoveryExecutor = retry(
    handleWhenResult(res => !res).orWhen(err => this.isRetriableNetworkError(err)),
    {
      maxAttempts: 5,
      backoff: new ExponentialBackoff({ maxDelay: 10_000, initialDelay: 1_000 })
    }
  );

  private readonly getChainId = memoizeAsync(() => this.client.getChainId());

  private readonly getAddress = memoizeAsync(() => this.wallet.getFirstAddress());

  private readonly logger = createOtelLogger({ context: this.loggerContext });

  get hasPendingTransactions() {
    return this.activeBatches > 0 || this.semaphore.nrWaiting() > 0;
  }

  constructor(
    private readonly config: AppConfigService,
    private readonly wallet: Wallet,
    private readonly registry: Registry,
    createClientWithSigner: CreateSigningStargateClient,
    private readonly loggerContext = BatchSigningClientService.name
  ) {
    this.client = createClientWithSigner(this.config.get("RPC_NODE_ENDPOINT"), this.wallet, {
      registry: this.registry
    });
  }

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

  private async signAndBroadcastBatchBlocking(inputs: readonly SignAndBroadcastBatchOptions[]): Promise<Result<string, unknown>[]> {
    await this.semaphore.acquire();
    this.activeBatches++;
    try {
      return await this.executeAndBroadcastBatch(inputs);
    } finally {
      this.semaphore.release();
      this.activeBatches--;
    }
  }

  private async executeAndBroadcastBatch(inputs: readonly SignAndBroadcastBatchOptions[]): Promise<Result<string, unknown>[]> {
    return await withSpan("BatchSigningClientService.executeTxBatch", async () => {
      const signResults = await this.signBatch(inputs);
      return await this.broadcastBatch(signResults);
    });
  }

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

  private isRetriableNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    if ("code" in error) {
      return isRetriableError(error as Error & { code: unknown });
    }

    if ("cause" in error && error.cause instanceof Error && "code" in error.cause) {
      return isRetriableError(error.cause as Error & { code: unknown });
    }

    return false;
  }

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

  private async estimateFee(messages: readonly EncodeObject[], denom: string, granter?: string) {
    const gasEstimation = await this.client.simulate(await this.getAddress(), messages, "");
    const estimatedGas = Math.ceil(gasEstimation * this.config.get("GAS_SAFETY_MULTIPLIER"));

    const fee = calculateFee(estimatedGas, GasPrice.fromString(`${this.config.get("AVERAGE_GAS_PRICE")}${denom}`));

    return granter ? { ...fee, granter } : fee;
  }
}
