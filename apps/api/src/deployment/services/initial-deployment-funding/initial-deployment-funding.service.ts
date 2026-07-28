import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { RpcMessageService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { averageBlockCountInAnHour, COSMOS_TX_CODE_OK } from "@src/utils/constants";

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
  private readonly logger: ReturnType<CreateLogger>;

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
    private readonly chainErrorService: ChainErrorService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: InitialDeploymentFundingService.name });
  }

  /**
   * Throws when the lease is not yet visible over chain REST (indexing lag) or
   * when the deposit tx fails on-chain, so the job queue retries with backoff.
   * A deposit rejected because the deployment escrow account is already closed
   * is terminal — retrying against a closed account can never succeed.
   * Every other early exit is terminal: the hourly cron remains the safety net.
   */
  async fundOnLeaseStarted({ walletId, address, dseq }: FundOnLeaseStartedInput): Promise<void> {
    const [deployment] = await this.drainingDeploymentService.findLeases(Number.MAX_SAFE_INTEGER, address, [dseq]);

    if (!deployment) {
      throw new Error(`Lease for deployment ${dseq} owned by ${address} is not visible on chain yet`);
    }

    if (deployment.closedHeight) {
      this.logger.info({ event: "INITIAL_FUNDING_SKIPPED", reason: "DEPLOYMENT_CLOSED", dseq, address });
      return;
    }

    const currentHeight = await this.blockHttpService.getCurrentHeight();
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

    let tx;
    try {
      tx = await this.managedSignerService.executeDerivedTx(walletId, [message]);
    } catch (error) {
      if (error instanceof Error && this.chainErrorService.isDeploymentClosedError(error)) {
        this.logger.info({ event: "INITIAL_FUNDING_SKIPPED", reason: "DEPLOYMENT_CLOSED", dseq, address, error: error.message });
        return;
      }
      throw error;
    }

    if (tx.code !== COSMOS_TX_CODE_OK) {
      const txError = new Error(tx.rawLog || `Deposit tx ${tx.hash} failed on-chain with code ${tx.code}`);

      if (this.chainErrorService.isDeploymentClosedError(txError)) {
        this.logger.info({ event: "INITIAL_FUNDING_SKIPPED", reason: "DEPLOYMENT_CLOSED", dseq, address, txHash: tx.hash });
        return;
      }

      this.logger.error({ event: "INITIAL_FUNDING_TX_FAILED", dseq, address, txHash: tx.hash, code: tx.code, rawLog: tx.rawLog });
      throw txError;
    }

    await this.walletReloadJobService.scheduleImmediate({ walletId });

    this.logger.info({ event: "INITIAL_FUNDING_DEPOSITED", dseq, address, amount, blockRate: deployment.blockRate });
  }
}
