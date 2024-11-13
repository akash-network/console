import { LoggerService } from "@akashnetwork/logging";
import type { StdFee } from "@cosmjs/amino";
import { toHex } from "@cosmjs/encoding";
import { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import type { SignerData } from "@cosmjs/stargate/build/signingstargateclient";
import { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { BroadcastTxSyncResponse } from "@cosmjs/tendermint-rpc/build/comet38";
import { Sema } from "async-sema";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import DataLoader from "dataloader";
import assert from "http-assert";

import { BillingConfig } from "@src/billing/providers";
import { BatchSigningStargateClient } from "@src/billing/services/batch-signing-stargate-client/batch-signing-stargate-client";
import { MasterWalletService } from "@src/billing/services/master-wallet/master-wallet.service";

interface ShortAccountInfo {
  accountNumber: number;
  sequence: number;
}

interface ExecuteTxOptions {
  fee: {
    granter: string;
  };
}

interface ExecuteTxInput {
  messages: readonly EncodeObject[];
  options?: ExecuteTxOptions;
}

export class MasterSigningClientService {
  private readonly FEES_DENOM = "uakt";

  private clientAsPromised: Promise<BatchSigningStargateClient>;

  private readonly semaphore = new Sema(1);

  private accountInfo: ShortAccountInfo;

  private chainId: string;

  private execTxLoader = new DataLoader(
    async (batchedInputs: ExecuteTxInput[]) => {
      return this.executeTxBatchBlocking(batchedInputs);
    },
    { cache: false, batchScheduleFn: callback => setTimeout(callback, this.config.MASTER_WALLET_BATCHING_INTERVAL_MS) }
  );

  private readonly logger = LoggerService.forContext(this.loggerContext);

  constructor(
    private readonly config: BillingConfig,
    private readonly masterWalletService: MasterWalletService,
    private readonly registry: Registry,
    private readonly loggerContext = MasterSigningClientService.name
  ) {
    this.clientAsPromised = this.initClient();
  }

  private async initClient() {
    return BatchSigningStargateClient.connectWithSigner(this.config.RPC_NODE_ENDPOINT, this.masterWalletService, {
      registry: this.registry
    }).then(async client => {
      this.accountInfo = await client.getAccount(await this.masterWalletService.getFirstAddress()).then(account => ({
        accountNumber: account.accountNumber,
        sequence: account.sequence
      }));
      this.chainId = await client.getChainId();

      return client;
    });
  }

  async signAndBroadcast(messages: readonly EncodeObject[], fee: StdFee | "auto" | number, memo?: string) {
    return (await this.clientAsPromised).signAndBroadcast(await this.masterWalletService.getFirstAddress(), messages, fee, memo);
  }

  async sign(messages: readonly EncodeObject[], fee: StdFee, memo: string, explicitSignerData?: SignerData) {
    return (await this.clientAsPromised).sign(await this.masterWalletService.getFirstAddress(), messages, fee, memo, explicitSignerData);
  }

  async simulate(messages: readonly EncodeObject[], memo: string) {
    return (await this.clientAsPromised).simulate(await this.masterWalletService.getFirstAddress(), messages, memo);
  }

  async executeTx(messages: readonly EncodeObject[], options?: ExecuteTxOptions) {
    const tx = await this.execTxLoader.load({ messages, options });

    assert(tx.code === 0, 500, "Failed to sign and broadcast tx", { data: tx });

    return tx;
  }

  private async executeTxBatchBlocking(inputs: ExecuteTxInput[]): Promise<IndexedTx[]> {
    await this.semaphore.acquire();
    try {
      return await this.executeTxBatch(inputs);
    } catch (error) {
      if (error.message.includes("account sequence mismatch")) {
        this.logger.debug("Account sequence mismatch, retrying...");

        this.clientAsPromised = this.initClient();
        return await this.executeTxBatch(inputs);
      }

      throw error;
    } finally {
      this.semaphore.release();
    }
  }

  private async executeTxBatch(inputs: ExecuteTxInput[]): Promise<IndexedTx[]> {
    const txes: TxRaw[] = [];
    let txIndex: number = 0;

    const client = await this.clientAsPromised;
    const masterAddress = await this.masterWalletService.getFirstAddress();

    while (txIndex < inputs.length) {
      const { messages, options } = inputs[txIndex];
      const fee = await this.estimateFee(messages, this.FEES_DENOM, options?.fee.granter, { mock: true });
      txes.push(
        await client.sign(masterAddress, messages, fee, "", {
          accountNumber: this.accountInfo.accountNumber,
          sequence: this.accountInfo.sequence++,
          chainId: this.chainId
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

    return await Promise.all(hashes.map(hash => client.getTx(hash)));
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
    const estimatedGas = Math.round(gasEstimation * this.config.GAS_SAFETY_MULTIPLIER);

    return calculateFee(estimatedGas, GasPrice.fromString(`0.025${denom}`));
  }
}
