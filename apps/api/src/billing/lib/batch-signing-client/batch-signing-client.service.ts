import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { LoggerService } from "@akashnetwork/logging";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { Sema } from "async-sema";
import DataLoader from "dataloader";
import { backOff } from "exponential-backoff";
import assert from "http-assert";

import type { SyncSigningStargateClient } from "@src/billing/lib/sync-signing-stargate-client/sync-signing-stargate-client";
import type { Wallet } from "@src/billing/lib/wallet/wallet";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { withSpan } from "@src/core/services/tracing/tracing.service";

export interface ExecuteTxOptions {
  fee: {
    granter: string;
  };
}

interface ExecuteTxInput {
  messages: readonly EncodeObject[];
  options?: ExecuteTxOptions;
}

type CreateWithSignerFn = (endpoint: string, wallet: Wallet, options: { registry: Registry }) => SyncSigningStargateClient;

export class BatchSigningClientService {
  private readonly FEES_DENOM = "uakt";

  private client: SyncSigningStargateClient;

  private readonly semaphore = new Sema(1);

  private chainId?: string;

  private execTxLoader = new DataLoader(
    async (batchedInputs: readonly ExecuteTxInput[]) => {
      return this.executeTxBatchBlocking(batchedInputs as ExecuteTxInput[]);
    },
    { cache: false, batchScheduleFn: callback => setTimeout(callback, this.config.get("WALLET_BATCHING_INTERVAL_MS")) }
  );

  private readonly logger = LoggerService.forContext(this.loggerContext);

  constructor(
    private readonly config: BillingConfigService,
    private readonly wallet: Wallet,
    private readonly registry: Registry,
    private readonly createWithSigner: CreateWithSignerFn,
    private readonly chainErrorService: ChainErrorService,
    private readonly loggerContext = BatchSigningClientService.name
  ) {
    this.client = this.createWithSigner(this.config.get("RPC_NODE_ENDPOINT"), this.wallet, {
      registry: this.registry
    });
    this.init();
  }

  get hasPendingTransactions() {
    return this.semaphore.nrWaiting() > 0;
  }

  async executeTx(messages: readonly EncodeObject[], options?: ExecuteTxOptions) {
    const tx = await this.execTxLoader.load({ messages, options });

    assert(tx?.code === 0, 500, "Failed to sign and broadcast tx", { data: tx });

    return tx;
  }

  async disconnect() {
    this.client.disconnect();
  }

  async dispose() {
    await this.disconnect();
  }

  private async init() {
    this.chainId = await this.client.getChainId();
  }

  private async executeTxBatchBlocking(inputs: ExecuteTxInput[]): Promise<IndexedTx[]> {
    await this.semaphore.acquire();
    try {
      return await backOff(() => this.executeTxBatch(inputs), {
        maxDelay: 5_000,
        startingDelay: 500,
        timeMultiple: 2,
        numOfAttempts: 5,
        jitter: "none",
        retry: async (error: Error, attempt) => {
          const isSequenceMismatch = error?.message?.includes("account sequence mismatch");

          if (isSequenceMismatch) {
            this.logger.warn({ event: "ACCOUNT_SEQUENCE_MISMATCH", address: await this.wallet.getFirstAddress(), attempt });

            return true;
          }

          return false;
        }
      });
    } finally {
      this.semaphore.release();
    }
  }

  private async executeTxBatch(inputs: ExecuteTxInput[]): Promise<IndexedTx[]> {
    return await withSpan("BatchSigningClientService.executeTxBatch", async () => {
      const address = await this.wallet.getFirstAddress();
      const accountInfo = await this.client.getAccount(address);

      if (!accountInfo) {
        throw new Error("Failed to get account info");
      }

      const txes: TxRaw[] = [];
      let txIndex: number = 0;
      while (txIndex < inputs.length) {
        const { messages, options } = inputs[txIndex];
        try {
          const fee = await this.estimateFee(messages, this.FEES_DENOM, options?.fee?.granter);

          txes.push(
            await this.client.sign(accountInfo.address, messages, fee, "", {
              accountNumber: accountInfo.accountNumber,
              sequence: accountInfo.sequence + txIndex,
              chainId: this.chainId!
            })
          );
        } catch (error: unknown) {
          throw await this.chainErrorService.toAppError(error as Error, messages);
        }

        txIndex++;
      }

      const hashes: string[] = [];
      txIndex = 0;
      while (txIndex < txes.length) {
        const txRaw = txes[txIndex];
        const txBytes = TxRaw.encode(txRaw).finish();

        try {
          if (txIndex < txes.length - 1) {
            const response = await this.client.tmBroadcastTxSync(txBytes);
            hashes.push(toHex(response.hash));
          } else {
            const lastDelivery = await this.client.broadcastTx(txBytes);
            hashes.push(lastDelivery.transactionHash);
          }
        } catch (error: any) {
          if (error?.message?.toLowerCase().includes("tx already exists in cache")) {
            const txHash = toHex(sha256(txBytes));
            hashes.push(txHash);
          } else {
            throw error;
          }
        }

        txIndex++;
      }

      const txs = await Promise.all(hashes.map(hash => this.client.getTx(hash)));
      return txs.map((tx, index) => {
        if (tx) {
          return tx;
        }

        return {
          height: 0,
          txIndex: 0,
          hash: hashes[index],
          code: 0,
          events: [] as IndexedTx["events"],
          rawLog: "",
          tx: new Uint8Array(),
          msgResponses: [] as IndexedTx["msgResponses"],
          gasUsed: BigInt(0),
          gasWanted: BigInt(0)
        };
      });
    });
  }

  private async estimateFee(messages: readonly EncodeObject[], denom: string, granter?: string, options?: { mock?: boolean }) {
    if (options?.mock) {
      return {
        amount: [{ denom: this.FEES_DENOM, amount: "15000" }],
        gas: "500000",
        granter
      };
    }

    const gasEstimation = await this.simulate(messages, "");
    const estimatedGas = Math.ceil(gasEstimation * this.config.get("GAS_SAFETY_MULTIPLIER"));

    const fee = calculateFee(estimatedGas, GasPrice.fromString(`${this.config.get("AVERAGE_GAS_PRICE")}${denom}`));

    return granter ? { ...fee, granter } : fee;
  }

  private async simulate(messages: readonly EncodeObject[], memo: string) {
    return this.client.simulate(await this.wallet.getFirstAddress(), messages, memo);
  }
}
