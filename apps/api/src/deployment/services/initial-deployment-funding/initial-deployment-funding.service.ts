import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { RpcMessageService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { LoggerService } from "@src/core";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DrainingDeploymentService } from "../draining-deployment/draining-deployment.service";

export interface FundOnLeaseStartedInput {
  walletId: number;
  address: string;
  dseq: string;
}

/**
 * Funds a deployment right after its lease starts so high-cost deployments
 * cannot burn through the small initial deposit and get closed by the provider
 * before the hourly top-up cron first sees them.
 */
@singleton()
export class InitialDeploymentFundingService {
  constructor(
    private readonly blockHttpService: BlockHttpService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly balancesService: BalancesService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly billingConfig: BillingConfigService,
    private readonly deploymentConfig: DeploymentConfigService,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(InitialDeploymentFundingService.name);
  }

  /**
   * Throws when the lease is not yet visible over chain REST so the job queue
   * retries with backoff through the indexing lag. Every other early exit is
   * terminal: the hourly cron remains the safety net.
   */
  async fundOnLeaseStarted({ walletId, address, dseq }: FundOnLeaseStartedInput): Promise<void> {
    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const [deployment] = await this.drainingDeploymentService.findLeases(Number.MAX_SAFE_INTEGER, address, [dseq]);

    if (!deployment) {
      throw new Error(`Lease for deployment ${dseq} owned by ${address} is not visible on chain yet`);
    }

    if (deployment.closedHeight) {
      this.logger.info({ event: "INITIAL_FUNDING_SKIPPED", reason: "DEPLOYMENT_CLOSED", dseq, address });
      return;
    }

    const lookAheadHeight = currentHeight + averageBlockCountInAnHour * this.deploymentConfig.get("AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H");

    if (deployment.predictedClosedHeight > lookAheadHeight) {
      this.logger.info({
        event: "INITIAL_FUNDING_SKIPPED",
        reason: "SUFFICIENT_RUNWAY",
        dseq,
        address,
        predictedClosedHeight: deployment.predictedClosedHeight,
        lookAheadHeight
      });
      return;
    }

    const desiredAmount = await this.drainingDeploymentService.calculateTopUpAmount(deployment);
    const { deployment: deploymentLimit } = await this.balancesService.getFreshLimits({ address });
    const amount = Math.min(desiredAmount, deploymentLimit);

    if (amount <= 0) {
      this.logger.warn({ event: "INITIAL_FUNDING_INSUFFICIENT_BALANCE", dseq, address, desiredAmount, deploymentLimit });
      return;
    }

    const userWallet = await this.userWalletRepository.findById(walletId);

    if (!userWallet) {
      this.logger.error({ event: "INITIAL_FUNDING_WALLET_NOT_FOUND", walletId, dseq });
      return;
    }

    const feeAllowance = await this.managedSignerService.ensureFeeGrants(userWallet);

    if (feeAllowance <= 0) {
      this.logger.warn({ event: "INITIAL_FUNDING_NO_FEE_ALLOWANCE", dseq, address });
      return;
    }

    const message = this.rpcMessageService.getDepositDeploymentMsg({
      dseq: Number(dseq),
      amount,
      denom: this.billingConfig.get("DEPLOYMENT_GRANT_DENOM"),
      owner: address,
      signer: address
    });

    await this.managedSignerService.executeDerivedTx(walletId, [message]);
    await this.walletReloadJobService.scheduleImmediate({ walletId });

    this.logger.info({ event: "INITIAL_FUNDING_DEPOSITED", dseq, address, amount, blockRate: deployment.blockRate });
  }
}
