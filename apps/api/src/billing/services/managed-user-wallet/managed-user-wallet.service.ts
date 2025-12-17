import { AuthzHttpService } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { EncodeObject } from "@cosmjs/proto-signing";
import add from "date-fns/add";
import addDays from "date-fns/addDays";
import isAfter from "date-fns/isAfter";
import subDays from "date-fns/subDays";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import type { UserWalletOutput } from "@src/billing/repositories";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { ManagedSignerService } from "../managed-signer/managed-signer.service";
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
  private readonly logger = LoggerService.forContext(ManagedUserWalletService.name);

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly txManagerService: TxManagerService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly authzHttpService: AuthzHttpService
  ) {}

  async createAndAuthorizeTrialSpending(
    signer: ManagedSignerService,
    { addressIndex, useOldWallet = false }: { addressIndex: number; useOldWallet?: boolean }
  ) {
    const address = await this.txManagerService.getDerivedWalletAddress(addressIndex, useOldWallet);

    const limits = {
      deployment: this.config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT,
      fees: this.config.TRIAL_FEES_ALLOWANCE_AMOUNT
    };
    await this.authorizeSpending(
      signer,
      {
        address,
        limits: limits,
        expiration: add(new Date(), { days: this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS })
      },
      useOldWallet
    );

    return { address, limits };
  }

  async createWallet({ addressIndex, useOldWallet = false }: { addressIndex: number; useOldWallet?: boolean }) {
    const address = await this.txManagerService.getDerivedWalletAddress(addressIndex, useOldWallet);
    this.logger.debug({ event: "WALLET_CREATED", address });

    return { address };
  }

  async refillWalletFees(signer: ManagedSignerService, userWallet: UserWalletOutput) {
    const trialWindowStart = subDays(new Date(), this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS);
    const isInTrialWindow = userWallet.isTrialing && isAfter(userWallet.createdAt, trialWindowStart);
    const expiration = isInTrialWindow ? addDays(userWallet.createdAt, this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS) : undefined;

    await this.authorizeSpending(
      signer,
      {
        address: userWallet.address!,
        limits: {
          fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
        },
        expiration
      },
      userWallet.isOldWallet ?? false
    );
  }

  async authorizeSpending(signer: ManagedSignerService, options: SpendingAuthorizationOptions, useOldWallet: boolean = false) {
    const fundingWalletAddress = await this.txManagerService.getFundingWalletAddress(useOldWallet);
    const msgOptions = {
      granter: fundingWalletAddress,
      grantee: options.address,
      expiration: options.expiration
    };

    await Promise.all([
      "deployment" in options.limits &&
        this.authorizeDeploymentSpending(
          signer,
          {
            ...msgOptions,
            denom: this.config.DEPLOYMENT_GRANT_DENOM,
            limit: options.limits.deployment
          },
          useOldWallet
        ),
      this.authorizeFeeSpending(
        signer,
        {
          ...msgOptions,
          limit: options.limits.fees
        },
        useOldWallet
      )
    ]);

    this.logger.debug({ event: "SPENDING_AUTHORIZED", address: options.address });
  }

  private async authorizeFeeSpending(signer: ManagedSignerService, options: Omit<SpendingAuthorizationMsgOptions, "denom">, useOldWallet: boolean = false) {
    const messages: EncodeObject[] = [];
    const hasValidFeeAllowance = await this.authzHttpService.hasFeeAllowance(options.granter, options.grantee);

    if (hasValidFeeAllowance) {
      messages.push(this.rpcMessageService.getRevokeAllowanceMsg(options));
    }

    messages.push(this.rpcMessageService.getFeesAllowanceGrantMsg(options));

    return await signer.executeFundingTx(messages, useOldWallet);
  }

  private async authorizeDeploymentSpending(signer: ManagedSignerService, options: SpendingAuthorizationMsgOptions, useOldWallet: boolean = false) {
    const deploymentAllowanceMsg = this.rpcMessageService.getDepositDeploymentGrantMsg(options);
    return await signer.executeFundingTx([deploymentAllowanceMsg], useOldWallet);
  }
}
