import { AuthzHttpService } from "@akashnetwork/http-sdk";
import { EncodeObject } from "@cosmjs/proto-signing";
import { ConstantBackoff, handleWhenResult, type IPolicy, retry } from "cockatiel";
import add from "date-fns/add";
import addDays from "date-fns/addDays";
import isAfter from "date-fns/isAfter";
import subDays from "date-fns/subDays";
import assert from "http-assert";
import { BadGateway } from "http-errors";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import type { UserWalletOutput } from "@src/billing/repositories";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { LoggerService } from "@src/core/providers/logging.provider";
import { Trace, withSpan } from "@src/core/services/tracing/tracing.service";
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
  private readonly feeGrantVerifyPolicy: IPolicy = retry(
    handleWhenResult(res => !res),
    {
      maxAttempts: 2,
      backoff: new ConstantBackoff(0)
    }
  );

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly txManagerService: TxManagerService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly authzHttpService: AuthzHttpService,
    private readonly logger: LoggerService
  ) {}

  async createAndAuthorizeTrialSpending(signer: ManagedSignerService, { addressIndex }: { addressIndex: number }) {
    const address = await this.txManagerService.getDerivedWalletAddress(addressIndex);

    const limits = {
      deployment: this.config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT,
      fees: this.config.TRIAL_FEES_ALLOWANCE_AMOUNT
    };
    await this.authorizeSpending(signer, {
      address,
      limits: limits,
      expiration: add(new Date(), { days: this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS })
    });

    return { address, limits };
  }

  async createWallet({ addressIndex }: { addressIndex: number }) {
    const address = await this.txManagerService.getDerivedWalletAddress(addressIndex);
    this.logger.debug({ event: "WALLET_CREATED", address });

    return { address };
  }

  @Trace()
  async authorizeSpending(signer: ManagedSignerService, options: SpendingAuthorizationOptions) {
    const fundingWalletAddress = await this.txManagerService.getFundingWalletAddress();
    const msgOptions = {
      granter: fundingWalletAddress,
      grantee: options.address,
      expiration: options.expiration
    };

    await Promise.all([
      "deployment" in options.limits &&
        this.authorizeDeploymentSpending(signer, {
          ...msgOptions,
          denom: this.config.DEPLOYMENT_GRANT_DENOM,
          limit: options.limits.deployment
        }),
      this.authorizeFeeSpending(signer, {
        ...msgOptions,
        limit: options.limits.fees
      })
    ]);

    this.logger.debug({ event: "SPENDING_AUTHORIZED", address: options.address });
  }

  /**
   * Refills fee authorization for a wallet that is eligible for trial allowances.
   * Authorizes fees for wallets in the trial window, applying the same logic as RefillService.refillWalletFees.
   * Sets expiration date based on a trial window if the wallet is trialing.
   *
   * @param signer - The ManagedSignerService instance to use for authorization
   * @param userWallet - The user wallet to refill fees for
   */
  @Trace()
  async refillWalletFees(signer: ManagedSignerService, wallet: Pick<UserWalletOutput, "address" | "isTrialing" | "createdAt">) {
    assert(wallet.address, 402, "Wallet is not initialized");

    const trialWindowStart = subDays(new Date(), this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS);
    const isInTrialWindow = wallet.isTrialing && isAfter(wallet.createdAt, trialWindowStart);
    const expiration = isInTrialWindow ? addDays(wallet.createdAt, this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS) : undefined;
    const fees = this.config.FEE_ALLOWANCE_REFILL_AMOUNT;

    await this.authorizeSpending(signer, {
      address: wallet.address,
      limits: {
        fees
      },
      expiration
    });
  }

  private async authorizeFeeSpending(signer: ManagedSignerService, options: Omit<SpendingAuthorizationMsgOptions, "denom">) {
    return withSpan("ManagedUserWalletService.authorizeFeeSpending", async () => {
      const messages: EncodeObject[] = [];
      const hasValidFeeAllowance = await this.authzHttpService.hasFeeAllowance(options.granter, options.grantee);

      if (hasValidFeeAllowance) {
        messages.push(this.rpcMessageService.getRevokeAllowanceMsg(options));
      }

      messages.push(this.rpcMessageService.getFeesAllowanceGrantMsg(options));

      const result = await signer.executeFundingTx(messages);

      if (hasValidFeeAllowance) {
        await this.ensureFeeAllowanceLanded(signer, options);
      }

      return result;
    });
  }

  private async ensureFeeAllowanceLanded(signer: ManagedSignerService, options: Omit<SpendingAuthorizationMsgOptions, "denom">) {
    if (await this.authzHttpService.hasFeeAllowance(options.granter, options.grantee)) {
      return;
    }
    const hasFeeAllowance = await this.feeGrantVerifyPolicy.execute(async () => {
      this.logger.warn({
        event: "FEE_GRANT_SILENTLY_DROPPED",
        granter: options.granter,
        grantee: options.grantee
      });

      await signer.executeFundingTx([this.rpcMessageService.getFeesAllowanceGrantMsg(options)]);

      return await this.authzHttpService.hasFeeAllowance(options.granter, options.grantee);
    });

    if (!hasFeeAllowance) {
      this.logger.error({
        event: "FEE_GRANT_REISSUE_FAILED",
        granter: options.granter,
        grantee: options.grantee
      });
      throw new BadGateway();
    }
  }

  private async authorizeDeploymentSpending(signer: ManagedSignerService, options: SpendingAuthorizationMsgOptions) {
    return withSpan("ManagedUserWalletService.authorizeDeploymentSpending", async () => {
      const deploymentAllowanceMsg = this.rpcMessageService.getDepositDeploymentGrantMsg(options);
      return await signer.executeFundingTx([deploymentAllowanceMsg]);
    });
  }
}
