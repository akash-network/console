import { LoggerService } from "@akashnetwork/logging";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import type { BroadcastTxSyncResponse } from "@cosmjs/tendermint-rpc/build/comet38";
import { Sema } from "async-sema";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import DataLoader from "dataloader";
import { backOff } from "exponential-backoff";
import assert from "http-assert";

import { SyncSigningStargateClient } from "@src/billing/lib/sync-signing-stargate-client/sync-signing-stargate-client";
import type { Wallet } from "@src/billing/lib/wallet/wallet";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { withSpan } from "@src/core/services/tracing/tracing.service";

interface ShortAccountInfo {
  accountNumber: number;
  sequence: number;
}

export interface ExecuteTxOptions {
  fee: {
    granter: string;
  };
}

interface ExecuteTxInput {
  messages: readonly EncodeObject[];
  options?: ExecuteTxOptions;
}

export class BatchSigningClientService {
  private readonly FEES_DENOM = "uakt";

  private clientAsPromised: Promise<SyncSigningStargateClient>;

  private readonly semaphore = new Sema(1);

  private accountInfo?: ShortAccountInfo;

  private chainId?: string;

  private execTxLoader = new DataLoader(
    async (batchedInputs: readonly ExecuteTxInput[]) => {
      return this.executeTxBatchBlocking(batchedInputs as ExecuteTxInput[]);
    },
    { cache: false, batchScheduleFn: callback => setTimeout(callback, this.config.get("WALLET_BATCHING_INTERVAL_MS")) }
  );

  private readonly logger = LoggerService.forContext(this.loggerContext);

  get hasPendingTransactions() {
    return this.semaphore.nrWaiting() > 0;
  }

  constructor(
    private readonly config: BillingConfigService,
    private readonly wallet: Wallet,
    private readonly registry: Registry,
    private readonly loggerContext = BatchSigningClientService.name
  ) {
    this.clientAsPromised = this.initClient();
  }

  private async initClient() {
    return await backOff(
      () =>
        SyncSigningStargateClient.connectWithSigner(this.config.get("RPC_NODE_ENDPOINT"), this.wallet, {
          registry: this.registry
        }).then(async client => {
          this.chainId = await client.getChainId();
          return client;
        }),
      {
        maxDelay: 10_000,
        startingDelay: 500,
        timeMultiple: 2,
        numOfAttempts: 7,
        jitter: "full"
      }
    );
  }

  async executeTx(messages: readonly EncodeObject[], options?: ExecuteTxOptions) {
    const tx = await this.execTxLoader.load({ messages, options });

    assert(tx?.code === 0, 500, "Failed to sign and broadcast tx", { data: tx });

    return tx;
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
            this.clientAsPromised = this.initClient();
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
      const txes: TxRaw[] = [];
      let txIndex: number = 0;

      const client = await this.clientAsPromised;
      const accountInfo = await this.updateAccountInfo();

      const address = await this.wallet.getFirstAddress();

      while (txIndex < inputs.length) {
        const { messages, options } = inputs[txIndex];
        const fee = await this.estimateFee(messages, this.FEES_DENOM, options?.fee.granter);
        txes.push(
          await client.sign(address, messages, fee, "", {
            accountNumber: accountInfo.accountNumber,
            sequence: accountInfo.sequence++,
            chainId: this.chainId!
          })
        );
        txIndex++;
      }

      const responses: BroadcastTxSyncResponse[] = [];
      txIndex = 0;

      while (txIndex < txes.length - 1) {
        const txRaw: TxRaw = txes[txIndex];
        responses.push(await client.tmBroadcastTxSync(TxRaw.encode(txRaw).finish()));
        txIndex++;
      }

      const lastDelivery = await client.broadcastTx(TxRaw.encode(txes[txes.length - 1]).finish());
      const hashes = [...responses.map(hash => toHex(hash.hash)), lastDelivery.transactionHash];

      const txs = await Promise.all(hashes.map(hash => client.getTx(hash)));
      return txs.filter(tx => tx !== null);
    });
  }

  private async updateAccountInfo() {
    const client = await this.clientAsPromised;
    const accountInfo = await client.getAccount(await this.wallet.getFirstAddress()).then(account => ({
      accountNumber: account!.accountNumber,
      sequence: account!.sequence
    }));
    this.accountInfo = accountInfo;
    return accountInfo;
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
    const estimatedGas = Math.round(gasEstimation * this.config.get("GAS_SAFETY_MULTIPLIER"));

    const fee = calculateFee(estimatedGas, GasPrice.fromString(`${this.config.get("AVERAGE_GAS_PRICE")}${denom}`));

    return granter ? { ...fee, granter } : fee;
  }

  private async simulate(messages: readonly EncodeObject[], memo: string) {
    return (await this.clientAsPromised).simulate(await this.wallet.getFirstAddress(), messages, memo);
  }
}
