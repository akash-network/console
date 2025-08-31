import { LoggerService } from "@akashnetwork/logging";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { Sema } from "async-sema";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import DataLoader from "dataloader";
import { backOff } from "exponential-backoff";
import assert from "http-assert";

import type { SyncSigningStargateClient } from "@src/billing/lib/sync-signing-stargate-client/sync-signing-stargate-client";
import type { Wallet } from "@src/billing/lib/wallet/wallet";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { withSpan } from "@src/core/services/tracing/tracing.service";

interface ShortAccountInfo {
  accountNumber: number;
  sequence: number;
  address: string;
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

type ConnectWithSignerFn = (endpoint: string, wallet: Wallet, options: { registry: Registry }) => Promise<SyncSigningStargateClient>;

export class BatchSigningClientService {
  private readonly FEES_DENOM = "uakt";

  private clientAsPromised: Promise<SyncSigningStargateClient>;

  private readonly semaphore = new Sema(1);

  private chainId?: string;

  private cachedFirstAddress?: string;
  private firstAddressPromise?: Promise<string>;

  private cachedAccountInfo?: ShortAccountInfo;
  private accountInfoPromise?: Promise<ShortAccountInfo>;

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
    private readonly connectWithSigner: ConnectWithSignerFn,
    private readonly loggerContext = BatchSigningClientService.name
  ) {
    this.clientAsPromised = this.initClient();
  }

  get hasPendingTransactions() {
    return this.semaphore.nrWaiting() > 0;
  }

  async executeTx(messages: readonly EncodeObject[], options?: ExecuteTxOptions) {
    const tx = await this.execTxLoader.load({ messages, options });

    assert(tx?.code === 0, 500, "Failed to sign and broadcast tx", { data: tx });

    return tx;
  }

  private async initClient() {
    return await backOff(
      () =>
        this.connectWithSigner(this.config.get("RPC_NODE_ENDPOINT"), this.wallet, {
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

  private async getCachedFirstAddress(): Promise<string> {
    if (this.cachedFirstAddress) {
      return this.cachedFirstAddress;
    }

    if (this.firstAddressPromise) {
      return this.firstAddressPromise;
    }

    this.firstAddressPromise = this.wallet
      .getFirstAddress()
      .then(address => {
        this.cachedFirstAddress = address;
        this.firstAddressPromise = undefined;
        return address;
      })
      .catch(error => {
        this.firstAddressPromise = undefined;
        throw error;
      });

    return this.firstAddressPromise;
  }

  private async getCachedAccountInfo(): Promise<ShortAccountInfo> {
    if (this.cachedAccountInfo) {
      return this.cachedAccountInfo;
    }

    if (this.accountInfoPromise) {
      return this.accountInfoPromise;
    }

    this.accountInfoPromise = this.clientAsPromised
      .then(async client => {
        const address = await this.getCachedFirstAddress();
        const account = await client.getAccount(address);

        if (!account) {
          throw new Error(`Account not found for address: ${address}. The account may not exist on the blockchain yet.`);
        }

        const accountInfo = {
          accountNumber: account.accountNumber,
          sequence: account.sequence,
          address: address
        };

        this.cachedAccountInfo = accountInfo;
        this.accountInfoPromise = undefined;
        return accountInfo;
      })
      .catch(error => {
        this.accountInfoPromise = undefined;
        throw error;
      });

    return this.accountInfoPromise;
  }

  private incrementSequence(): void {
    if (this.cachedAccountInfo) {
      this.cachedAccountInfo.sequence++;
    }
  }

  private clearCachedAccountInfo(): void {
    this.cachedAccountInfo = undefined;
    this.accountInfoPromise = undefined;
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
            this.clearCachedAccountInfo();
            this.logger.warn({ event: "ACCOUNT_SEQUENCE_MISMATCH", address: await this.getCachedFirstAddress(), attempt });

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
      const client = await this.clientAsPromised;

      // For RPC proxy scenarios, fetch account info once before the entire batch
      // This ensures we get a consistent sequence number for all transactions in the batch
      let accountInfo: ShortAccountInfo;
      if (this.config.get("ALWAYS_FETCH_FRESH_ACCOUNT_INFO") === "true") {
        accountInfo = await this.getFreshAccountInfo();
      } else {
        accountInfo = await this.getCachedAccountInfo();
      }

      const txes: TxRaw[] = [];
      let txIndex: number = 0;
      while (txIndex < inputs.length) {
        const { messages, options } = inputs[txIndex];
        const fee = await this.estimateFee(messages, this.FEES_DENOM, options?.fee?.granter);

        txes.push(
          await client.sign(accountInfo.address, messages, fee, "", {
            accountNumber: accountInfo.accountNumber,
            sequence: accountInfo.sequence,
            chainId: this.chainId!
          })
        );
        this.incrementSequence();
        txIndex++;
      }

      const hashes: string[] = [];
      txIndex = 0;
      while (txIndex < txes.length) {
        const txRaw = txes[txIndex];
        const txBytes = TxRaw.encode(txRaw).finish();

        try {
          if (txIndex < txes.length - 1) {
            const response = await client.tmBroadcastTxSync(txBytes);
            hashes.push(toHex(response.hash));
          } else {
            const lastDelivery = await client.broadcastTx(txBytes);
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

      const txs = await Promise.all(hashes.map(hash => client.getTx(hash)));
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
    const estimatedGas = Math.round(gasEstimation * this.config.get("GAS_SAFETY_MULTIPLIER"));

    const fee = calculateFee(estimatedGas, GasPrice.fromString(`${this.config.get("AVERAGE_GAS_PRICE")}${denom}`));

    return granter ? { ...fee, granter } : fee;
  }

  private async simulate(messages: readonly EncodeObject[], memo: string) {
    return (await this.clientAsPromised).simulate(await this.getCachedFirstAddress(), messages, memo);
  }

  private async getFreshAccountInfo(): Promise<ShortAccountInfo> {
    const client = await this.clientAsPromised;
    const address = await this.getCachedFirstAddress();
    const account = await client.getAccount(address);

    if (!account) {
      throw new Error(`Account not found for address: ${address}. The account may not exist on the blockchain yet.`);
    }

    const accountInfo = {
      accountNumber: account.accountNumber,
      sequence: account.sequence,
      address: address
    };

    this.cachedAccountInfo = accountInfo;
    return accountInfo;
  }
}
