import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet, EncodeObject } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import add from "date-fns/add";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { MasterSigningClientService } from "@src/billing/services/master-signing-client/master-signing-client.service";
import { MasterWalletService } from "@src/billing/services/master-wallet/master-wallet.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { LoggerService } from "@src/core";
import { InternalServerException } from "@src/core/exceptions/internal-server.exception";

interface SpendingAuthorizationOptions {
  address: string;
  limits: {
    deployment: number;
    fees: number;
  };
  expiration: Date;
}

@singleton()
export class ManagedUserWalletService {
  private readonly PREFIX = "akash";

  private readonly HD_PATH = "m/44'/118'/0'/0";

  private readonly logger = new LoggerService({ context: ManagedUserWalletService.name });

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly masterWalletService: MasterWalletService,
    private readonly masterSigningClientService: MasterSigningClientService,
    private readonly rpcMessageService: RpcMessageService
  ) {}

  async createAndAuthorizeTrialSpending({ addressIndex }: { addressIndex: number }) {
    const { address } = await this.createWallet({ addressIndex });
    const limits = {
      deployment: this.config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT,
      fees: this.config.TRIAL_FEES_ALLOWANCE_AMOUNT
    };
    await this.authorizeSpending({
      address,
      limits: limits,
      expiration: add(new Date(), { days: this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS })
    });

    return { address, limits };
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
      const messages = this.rpcMessageService.getAllGrantMsgs({
        granter: await this.masterWalletService.getFirstAddress(),
        grantee: options.address,
        denom: this.config.TRIAL_ALLOWANCE_DENOM,
        expiration: options.expiration,
        limits: options.limits
      });
      const fee = await this.estimateFee(messages, this.config.TRIAL_ALLOWANCE_DENOM);
      const txResult = await this.masterSigningClientService.signAndBroadcast(messages, fee);

      if (txResult.code !== 0) {
        this.logger.error({ event: "SPENDING_AUTHORIZATION_FAILED", address: options.address, txResult });
        throw new InternalServerException("Failed to authorize spending for address");
      }

      this.logger.debug({ event: "SPENDING_AUTHORIZED", address: options.address });
    } catch (error) {
      error.message = `Failed to authorize spending for address ${options.address}: ${error.message}`;
      this.logger.error(error);

      if (error.message.includes("fee allowance already exists")) {
        this.logger.debug({ event: "SPENDING_ALREADY_AUTHORIZED", address: options.address });

        const revokeMessage = this.rpcMessageService.getRevokeAllowanceMsg({
          granter: await this.masterWalletService.getFirstAddress(),
          grantee: options.address
        });

        const fee = await this.estimateFee([revokeMessage], this.config.TRIAL_ALLOWANCE_DENOM);
        await this.masterSigningClientService.signAndBroadcast([revokeMessage], fee);
        await this.authorizeSpending(options);
      } else {
        throw error;
      }
    }
  }

  private async estimateFee(messages: readonly EncodeObject[], denom: string) {
    const gasEstimation = await this.masterSigningClientService.simulate(messages, "allowance grant");
    const estimatedGas = Math.round(gasEstimation * this.config.GAS_SAFETY_MULTIPLIER);

    return calculateFee(estimatedGas, GasPrice.fromString(`0.025${denom}`));
  }

  async refill(wallet: any) {
    return wallet;
  }
}
