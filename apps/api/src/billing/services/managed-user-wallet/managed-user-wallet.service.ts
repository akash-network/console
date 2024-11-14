import { AllowanceHttpService } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet, EncodeObject } from "@cosmjs/proto-signing";
import { IndexedTx } from "@cosmjs/stargate";
import add from "date-fns/add";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { InjectSigningClient } from "@src/billing/providers/signing-client.provider";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { MasterSigningClientService } from "@src/billing/services/master-signing-client/master-signing-client.service";
import { MasterWalletService } from "@src/billing/services/master-wallet/master-wallet.service";
import { RpcMessageService, SpendingAuthorizationMsgOptions } from "@src/billing/services/rpc-message-service/rpc-message.service";

interface SpendingAuthorizationOptions {
  address: string;
  limits:
    | {
        deployment: number;
        fees: number;
      }
    | {
        fees: number;
      };
  expiration?: Date;
}

@singleton()
export class ManagedUserWalletService {
  private readonly PREFIX = "akash";

  private readonly HD_PATH = "m/44'/118'/0'/0";

  private readonly logger = LoggerService.forContext(ManagedUserWalletService.name);

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    @InjectWallet("MANAGED") private readonly masterWalletService: MasterWalletService,
    @InjectSigningClient("MANAGED") private readonly masterSigningClientService: MasterSigningClientService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly allowanceHttpService: AllowanceHttpService
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
    const masterWalletAddress = await this.masterWalletService.getFirstAddress();
    const msgOptions = {
      granter: masterWalletAddress,
      grantee: options.address,
      expiration: options.expiration
    };

    await Promise.all([
      "deployment" in options.limits &&
        this.authorizeDeploymentSpending({
          ...msgOptions,
          denom: this.config.DEPLOYMENT_GRANT_DENOM,
          limit: options.limits.deployment
        }),
      this.authorizeFeeSpending({
        ...msgOptions,
        limit: options.limits.fees
      })
    ]);

    this.logger.debug({ event: "SPENDING_AUTHORIZED", address: options.address });
  }

  private async authorizeFeeSpending(options: Omit<SpendingAuthorizationMsgOptions, "denom">) {
    const results: Promise<IndexedTx>[] = [];

    if (await this.allowanceHttpService.hasFeeAllowance(options.granter, options.grantee)) {
      results.push(this.masterSigningClientService.executeTx([this.rpcMessageService.getRevokeAllowanceMsg(options)]));
    }

    results.push(this.masterSigningClientService.executeTx([this.rpcMessageService.getFeesAllowanceGrantMsg(options)]));

    return await Promise.all(results);
  }

  private async authorizeDeploymentSpending(options: SpendingAuthorizationMsgOptions) {
    const deploymentAllowanceMsg = this.rpcMessageService.getDepositDeploymentGrantMsg(options);
    return await this.masterSigningClientService.executeTx([deploymentAllowanceMsg]);
  }

  async revokeAll(grantee: string, reason?: string) {
    const masterWalletAddress = await this.masterWalletService.getFirstAddress();
    const params = { granter: masterWalletAddress, grantee };
    const messages: EncodeObject[] = [];
    const revokeTypes: string[] = [];

    if (await this.allowanceHttpService.hasFeeAllowance(params.granter, params.grantee)) {
      revokeTypes.push("REVOKE_ALLOWANCE");
      messages.push(this.rpcMessageService.getRevokeAllowanceMsg(params));
    }

    if (await this.allowanceHttpService.hasDeploymentGrant(params.granter, params.grantee)) {
      revokeTypes.push("REVOKE_DEPOSIT_DEPLOYMENT_GRANT");
      messages.push(this.rpcMessageService.getRevokeDepositDeploymentGrantMsg(params));
    }

    if (messages.length) {
      await this.masterSigningClientService.executeTx(messages);
      this.logger.info({ event: "SPENDING_REVOKED", address: params.grantee, revokeTypes, reason });
    }
  }
}
