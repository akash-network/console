import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { Pubkey } from "@cosmjs/amino";
import { encodeSecp256k1Pubkey } from "@cosmjs/amino";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import type { IndexedTx, SigningStargateClient } from "@cosmjs/stargate";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
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
  fee?: {
    granter: string;
  };
}

interface SignAndBroadcastBatchOptions {
  messages: readonly EncodeObject[];
  options?: SignAndBroadcastOptions;
}

interface AccountState {
  accountNumber: number;
  sequence: number;
  pubkey: Pubkey;
  lastSyncedAt: number;
}

interface SimulateQueryClient {
  tx: {
    simulate: (
      messages: readonly ReturnType<Registry["encodeAsAny"]>[],
      memo: string | undefined,
      signer: Pubkey,
      sequence: number
    ) => Promise<{ gasInfo?: { gasUsed: bigint | number | string } }>;
  };
}

const SEQUENCE_MISMATCH_PATTERN = /account sequence mismatch, expected (\d+)/;

export class BatchSigningClientService {
  private readonly MEMO = "akash console";

  private readonly FEES_DENOM = "uakt";

  private readonly ACCOUNT_STATE_TTL_MS = 30_000;

  private client: SigningStargateClient;

  private readonly semaphore = new Sema(1);

  private activeBatches = 0;

  private accountState: AccountState | null = null;

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
    handleWhenResult(res => !res),
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

    if (tx.code !== 0) {
      this.logger.error({
        event: "TX_LANDED_WITH_NON_ZERO_CODE",
        txHash,
        code: tx.code,
        rawLog: tx.rawLog
      });
      throw new Error(`tx ${txHash} failed on-chain (code ${tx.code}): ${tx.rawLog ?? "unknown error"}`);
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
      const results = await this.executeAndBroadcastBatch(inputs);
      this.applySequenceMismatchRecovery(results);
      return results;
    } finally {
      this.semaphore.release();
      this.activeBatches--;
    }
  }

  private applySequenceMismatchRecovery(results: readonly Result<string, unknown>[]): void {
    for (const result of results) {
      if (result.ok) continue;
      const message = result.val instanceof Error ? result.val.message : String(result.val ?? "");
      if (!message.includes("account sequence mismatch")) continue;

      const match = SEQUENCE_MISMATCH_PATTERN.exec(message);
      if (match && this.accountState) {
        const expected = Number(match[1]);
        this.logger.warn({
          event: "SEQUENCE_MISMATCH_RECOVERED_FROM_ERROR",
          previousSequence: this.accountState.sequence,
          expectedSequence: expected
        });
        this.accountState = { ...this.accountState, sequence: expected, lastSyncedAt: Date.now() };
      } else {
        this.logger.warn({ event: "SEQUENCE_MISMATCH_CACHE_INVALIDATED", message });
        this.accountState = null;
      }
      return;
    }
  }

  private async executeAndBroadcastBatch(inputs: readonly SignAndBroadcastBatchOptions[]): Promise<Result<string, unknown>[]> {
    return await withSpan("BatchSigningClientService.executeTxBatch", async () => {
      const signResults = await this.signBatch(inputs);
      return await this.broadcastBatch(signResults);
    });
  }

  private async signBatch(inputs: readonly SignAndBroadcastBatchOptions[]): Promise<Result<TxRaw, unknown>[]> {
    const [address, chainId, accountState] = await Promise.all([this.getAddress(), this.getChainId(), this.getOrFetchAccountState()]);

    const results: Result<TxRaw, unknown>[] = [];
    let currentSequence = accountState.sequence;

    for (const input of inputs) {
      try {
        const { messages, options } = input;
        const fee = await this.estimateFee(messages, accountState.pubkey, currentSequence, this.FEES_DENOM, options?.fee?.granter);

        const signedTx = await this.client.sign(address, messages, fee, this.MEMO, {
          accountNumber: accountState.accountNumber,
          sequence: currentSequence,
          chainId
        });

        results.push(Ok(signedTx));
        currentSequence++;
      } catch (error: unknown) {
        results.push(Err(error));
      }
    }

    this.accountState = { ...accountState, sequence: currentSequence, lastSyncedAt: Date.now() };

    return results;
  }

  private async getOrFetchAccountState(): Promise<AccountState> {
    if (this.accountState && Date.now() - this.accountState.lastSyncedAt < this.ACCOUNT_STATE_TTL_MS) {
      return this.accountState;
    }

    const address = await this.getAddress();
    const [accountInfo, signerAccounts] = await Promise.all([this.client.getAccount(address), this.wallet.getAccounts()]);

    if (!accountInfo) {
      throw new Error("Failed to get account info");
    }

    const signerAccount = signerAccounts.find(account => account.address === address);
    if (!signerAccount) {
      throw new Error("Failed to retrieve account from signer");
    }
    const pubkey = encodeSecp256k1Pubkey(signerAccount.pubkey);

    const cachedSequence = this.accountState?.sequence;
    const chainSequence = accountInfo.sequence;
    const sequence = cachedSequence !== undefined && cachedSequence > chainSequence ? cachedSequence : chainSequence;

    this.accountState = {
      accountNumber: accountInfo.accountNumber,
      sequence,
      pubkey,
      lastSyncedAt: Date.now()
    };

    return this.accountState;
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

  private async tryRecoverTransaction(hash: string): Promise<IndexedTx | null> {
    return await this.txRecoveryExecutor.execute(context => {
      this.logger.debug({ event: "TX_RECOVERY_ATTEMPT", txHash: hash, attempt: context.attempt });
      return this.client.getTx(hash);
    });
  }

  private async estimateFee(messages: readonly EncodeObject[], pubkey: Pubkey, sequence: number, denom: string, granter?: string) {
    const anyMsgs = messages.map(m => this.registry.encodeAsAny(m));
    const queryClient = (this.client as unknown as { forceGetQueryClient(): SimulateQueryClient }).forceGetQueryClient();
    const { gasInfo } = await queryClient.tx.simulate(anyMsgs, this.MEMO, pubkey, sequence);

    if (!gasInfo) {
      throw new Error("Failed to simulate transaction: no gas info returned");
    }

    const gasUsed = Number(gasInfo.gasUsed);
    const estimatedGas = Math.ceil(gasUsed * this.config.get("GAS_SAFETY_MULTIPLIER"));

    const fee = calculateFee(estimatedGas, GasPrice.fromString(`${this.config.get("AVERAGE_GAS_PRICE")}${denom}`));

    return granter ? { ...fee, granter } : fee;
  }
}
