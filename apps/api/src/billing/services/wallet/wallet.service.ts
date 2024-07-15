import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet, EncodeObject } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import add from "date-fns/add";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { LoggerService } from "@src/core";

interface SpendingAuthorizationOptions {
  address: string;
  limits: {
    deployment: number;
    fees: number;
  };
  expiration: Date;
}

@singleton()
export class WalletService {
  private readonly PREFIX = "akash";

  private readonly HD_PATH = "m/44'/118'/0'/0";

  private masterWallet: DirectSecp256k1HdWallet;

  private client: SigningStargateClient;

  private readonly logger = new LoggerService({ context: WalletService.name });

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly rpcMessageService: RpcMessageService
  ) {}

  async createAndAuthorizeTrialSpending({ addressIndex }: { addressIndex: number }) {
    const { address } = await this.createWallet({ addressIndex });
    await this.authorizeSpending({
      address,
      limits: {
        deployment: this.config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT,
        fees: this.config.TRIAL_FEES_ALLOWANCE_AMOUNT
      },
      expiration: add(new Date(), { days: this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS })
    });

    return { address };
  }

  async createWallet({ addressIndex }: { addressIndex: number }) {
    const hdPath = stringToPath(`${this.HD_PATH}/${addressIndex}`);
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.config.MASTER_WALLET_MNEMONIC, {
      prefix: this.PREFIX,
      hdPaths: [hdPath]
    });
    const [account] = await wallet.getAccounts();
    this.logger.debug({ event: "WALLET_CREATED", address: account.address });

    return { address: account.address };
  }

  async authorizeSpending(options: SpendingAuthorizationOptions) {
    try {
      const masterWalletAddress = await this.getMasterWalletAddress();
      const messageParams = {
        granter: masterWalletAddress,
        grantee: options.address,
        denom: this.config.TRIAL_ALLOWANCE_DENOM,
        expiration: options.expiration
      };
      const messages = [
        this.rpcMessageService.getGrantMsg({
          ...messageParams,
          limit: options.limits.deployment
        }),
        this.rpcMessageService.getGrantBasicAllowanceMsg({
          ...messageParams,
          limit: options.limits.fees
        })
      ];
      const client = await this.getClient();
      const fee = await this.estimateFee(messages, this.config.TRIAL_ALLOWANCE_DENOM);
      await client.signAndBroadcast(masterWalletAddress, messages, fee);
      this.logger.debug({ event: "SPENDING_AUTHORIZED", address: options.address });
    } catch (error) {
      if (error.message.includes("fee allowance already exists")) {
        this.logger.debug({ event: "SPENDING_ALREADY_AUTHORIZED", address: options.address });
      } else {
        error.message = `Failed to authorize spending for address ${options.address}: ${error.message}`;
        this.logger.error(error);
        throw error;
      }
    }
  }

  private async estimateFee(messages: readonly EncodeObject[], denom: string) {
    const client = await this.getClient();
    const address = await this.getMasterWalletAddress();
    const gasEstimation = await client.simulate(address, messages, "allowance grant");
    const estimatedGas = Math.round(gasEstimation * this.config.GAS_SAFETY_MULTIPLIER);

    return calculateFee(estimatedGas, GasPrice.fromString(`0.025${denom}`));
  }

  async refill(wallet: any) {
    return wallet;
  }

  private async getMasterWalletAddress() {
    const masterWallet = await this.getMasterWallet();
    const [account] = await masterWallet.getAccounts();
    return account.address;
  }

  private async getMasterWallet() {
    if (!this.masterWallet) {
      this.masterWallet = await DirectSecp256k1HdWallet.fromMnemonic(this.config.MASTER_WALLET_MNEMONIC, { prefix: this.PREFIX });
    }

    return this.masterWallet;
  }

  private async getClient() {
    if (!this.client) {
      this.client = await SigningStargateClient.connectWithSigner(this.config.RPC_NODE_ENDPOINT, await this.getMasterWallet());
    }
    return this.client;
  }
}
