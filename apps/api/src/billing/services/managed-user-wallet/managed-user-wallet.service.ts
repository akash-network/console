import { AuthzHttpService } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet, EncodeObject } from "@cosmjs/proto-signing";
import add from "date-fns/add";
import { singleton } from "tsyringe";

import { Wallet } from "@src/billing/lib/wallet/wallet";
import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import type { DryRunOptions } from "@src/core/types/console";
import { ManagedSignerService } from "../managed-signer/managed-signer.service";
import { RpcMessageService, SpendingAuthorizationMsgOptions } from "../rpc-message-service/rpc-message.service";

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
    @InjectWallet("MANAGED") private readonly masterWallet: Wallet,
    private readonly managedSignerService: ManagedSignerService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly authzHttpService: AuthzHttpService
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
    const masterWalletAddress = await this.masterWallet.getFirstAddress();
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
    const messages: EncodeObject[] = [];
    const hasValidFeeAllowance = await this.authzHttpService.hasFeeAllowance(options.granter, options.grantee);

    if (hasValidFeeAllowance) {
      messages.push(this.rpcMessageService.getRevokeAllowanceMsg(options));
    }

    messages.push(this.rpcMessageService.getFeesAllowanceGrantMsg(options));

    return await this.managedSignerService.executeRootTx(messages);
  }

  private async authorizeDeploymentSpending(options: any) {
    const deploymentAllowanceMsg = this.rpcMessageService.getDepositDeploymentGrantMsg(options);
    return await this.managedSignerService.executeRootTx([deploymentAllowanceMsg]);
  }

  async revokeAll(grantee: string, reason?: string, options?: DryRunOptions) {
    const masterWalletAddress = await this.masterWallet.getFirstAddress();
    const params = { granter: masterWalletAddress, grantee };
    const messages: EncodeObject[] = [];
    const revokeSummary = {
      feeAllowance: false,
      deploymentGrant: false
    };

    if (await this.authzHttpService.hasFeeAllowance(params.granter, params.grantee)) {
      revokeSummary.feeAllowance = true;
      messages.push(this.rpcMessageService.getRevokeAllowanceMsg(params));
    }

    if (await this.authzHttpService.hasDepositDeploymentGrant(params.granter, params.grantee)) {
      revokeSummary.deploymentGrant = true;
      messages.push(this.rpcMessageService.getRevokeDepositDeploymentGrantMsg(params));
    }

    if (!messages.length) {
      return revokeSummary;
    }

    if (!options?.dryRun) {
      await this.managedSignerService.executeRootTx(messages);
    }

    this.logger.info({ event: "SPENDING_REVOKED", address: params.grantee, revokeSummary, reason });

    return revokeSummary;
  }
}
