import assert from "http-assert";
import { singleton } from "tsyringe";

import { ReviewTrialApproved } from "@src/billing/events/review-trial-approved";
import { ReviewTrialRejected } from "@src/billing/events/review-trial-rejected";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { LoggerService } from "@src/core";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";

@singleton()
export class ReviewTrialService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly rpcMessageService: RpcMessageService,
    private readonly domainEvents: DomainEventsService,
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly logger: LoggerService
  ) {
    logger.setContext(ReviewTrialService.name);
  }

  async approve(walletId: number, reason?: string) {
    const wallet = await this.userWalletRepository.findOneBy({ id: walletId });
    assert(wallet, 404, "Wallet not found");
    assert(wallet.reviewStatus === "pending", 400, "Wallet is not pending review");

    await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
      address: wallet.address!,
      limits: {
        deployment: this.config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT,
        fees: this.config.TRIAL_FEES_ALLOWANCE_AMOUNT
      }
    });

    const updated = await this.userWalletRepository.updateById(
      wallet.id,
      {
        deploymentAllowance: this.config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT,
        feeAllowance: this.config.TRIAL_FEES_ALLOWANCE_AMOUNT,
        reviewStatus: "approved"
      },
      { returning: true }
    );

    this.logger.info({ event: "REVIEW_TRIAL_APPROVED", walletId, userId: wallet.userId, reason });

    await this.domainEvents.publish(new ReviewTrialApproved({ userId: wallet.userId, reason }));

    return this.userWalletRepository.toPublic(updated);
  }

  async reject(walletId: number, reason?: string) {
    const wallet = await this.userWalletRepository.findOneBy({ id: walletId });
    assert(wallet, 404, "Wallet not found");
    assert(wallet.reviewStatus === "pending", 400, "Wallet is not pending review");

    if (wallet.address) {
      await this.closeAllDeployments(wallet.id, wallet.address);
    }

    const updated = await this.userWalletRepository.updateById(
      wallet.id,
      {
        deploymentAllowance: 0,
        feeAllowance: 0,
        isTrialing: false,
        reviewStatus: "rejected"
      },
      { returning: true }
    );

    this.logger.info({ event: "REVIEW_TRIAL_REJECTED", walletId, userId: wallet.userId, reason });

    await this.domainEvents.publish(new ReviewTrialRejected({ userId: wallet.userId, reason }));

    return this.userWalletRepository.toPublic(updated);
  }

  private async closeAllDeployments(walletId: number, address: string) {
    const { rows: deployments } = await this.deploymentRepository.findDeploymentsWithPagination({
      owner: address,
      state: "active"
    });

    const messages = deployments.map(deployment => this.rpcMessageService.getCloseDeploymentMsg(address, deployment.dseq));

    if (!messages.length) {
      return;
    }

    this.logger.info({ event: "REVIEW_TRIAL_CLOSING_DEPLOYMENTS", address, count: messages.length });

    try {
      await this.managedSignerService.executeDerivedTx(walletId, messages);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("not allowed to pay fees")) {
        await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
          address,
          limits: {
            fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
          }
        });
        await this.managedSignerService.executeDerivedTx(walletId, messages);
      } else {
        throw error;
      }
    }

    this.logger.info({ event: "REVIEW_TRIAL_DEPLOYMENTS_CLOSED", address });
  }
}
