import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { RpcMessageService } from "@src/billing/services";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { CachedBalanceService } from "@src/deployment/services/cached-balance/cached-balance.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { InitialDeploymentFundingInstrumentationService } from "@src/deployment/services/initial-deployment-funding/initial-deployment-funding-instrumentation.service";
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
    private readonly cachedBalanceService: CachedBalanceService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly billingConfig: BillingConfigService,
    private readonly deploymentConfig: DeploymentConfigService,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly chainErrorService: ChainErrorService,
    private readonly instrumentation: InitialDeploymentFundingInstrumentationService,
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
  async fundOnLeaseStarted(input: FundOnLeaseStartedInput): Promise<void> {
    try {
      await this.#fundOnLeaseStarted(input);
    } finally {
      await this.#scheduleCreditsLowCheck(input);
    }
  }

  /** Runs even when funding skipped, since a lease start moves the credits-low verdict either way, and never affects the funding outcome. */
  async #scheduleCreditsLowCheck({ walletId, dseq, address }: FundOnLeaseStartedInput): Promise<void> {
    try {
      await this.walletReloadJobService.scheduleCreditsLowCheckIfAutoReloadOff({ walletId });
    } catch (error) {
      try {
        this.logger.error({ event: "INITIAL_FUNDING_CREDITS_LOW_SCHEDULE_FAILED", walletId, dseq, address, error });
      } catch {
        return;
      }
    }
  }

  async #fundOnLeaseStarted({ walletId, address, dseq }: FundOnLeaseStartedInput): Promise<void> {
    const [deployment] = await this.drainingDeploymentService.findLeases(Number.MAX_SAFE_INTEGER, address, [dseq]);

    if (!deployment) {
      throw new Error(`Lease for deployment ${dseq} owned by ${address} is not visible on chain yet`);
    }

    if (deployment.closedHeight) {
      this.instrumentation.recordSkipped("deployment_closed", { dseq, address });
      return;
    }

    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const lookAheadHeight = currentHeight + averageBlockCountInAnHour * this.deploymentConfig.get("AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H");

    const userWallet = await this.userWalletRepository.findById(walletId);

    if (!userWallet) {
      this.instrumentation.recordSkipped("wallet_not_found", { walletId, dseq });
      return;
    }

    const deploymentSetting = await this.deploymentSettingRepository.findOneBy({ userId: userWallet.userId, dseq });
    const runtimeEndsAt = await this.startRuntimeCountdown(deploymentSetting);

    if (deploymentSetting && !deploymentSetting.autoTopUpEnabled) {
      this.logger.info({ event: "INITIAL_FUNDING_SKIPPED", reason: "AUTO_TOP_UP_DISABLED", dseq, address });
      return;
    }

    if (deployment.predictedClosedHeight > lookAheadHeight) {
      this.instrumentation.recordSkipped("sufficient_runway", {
        dseq,
        address,
        predictedClosedHeight: deployment.predictedClosedHeight,
        lookAheadHeight
      });
      return;
    }

    const desiredAmount = this.drainingDeploymentService.calculateAmountToTargetRunway({ ...deployment, runtimeEndsAt }, currentHeight);

    if (desiredAmount <= 0 && runtimeEndsAt) {
      this.instrumentation.recordSkipped("runtime_limit_reached", { dseq, address, runtimeEndsAt });
      return;
    }

    const balance = await this.cachedBalanceService.getFresh(address);
    const amount = Math.min(desiredAmount, balance.spendable);

    if (amount <= 0) {
      this.instrumentation.recordSkipped("insufficient_balance", {
        dseq,
        address,
        desiredAmount,
        available: balance.available,
        spendable: balance.spendable
      });
      return;
    }

    const feeAllowance = await this.managedSignerService.ensureFeeGrants(userWallet);

    if (feeAllowance <= 0) {
      this.instrumentation.recordSkipped("no_fee_allowance", { dseq, address });
      return;
    }

    const denom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");
    const message = this.rpcMessageService.getDepositDeploymentMsg({
      dseq: Number(dseq),
      amount,
      denom,
      owner: address,
      signer: address
    });

    let tx;
    try {
      tx = await this.managedSignerService.executeDerivedTx(walletId, [message]);
    } catch (error) {
      if (error instanceof Error && this.chainErrorService.isDeploymentClosedError(error)) {
        this.instrumentation.recordSkipped("deployment_closed", { dseq, address, error: error.message });
        return;
      }
      throw error;
    }

    if (tx.code !== COSMOS_TX_CODE_OK) {
      const txError = new Error(tx.rawLog || `Deposit tx ${tx.hash} failed on-chain with code ${tx.code}`);

      if (this.chainErrorService.isDeploymentClosedError(txError)) {
        this.instrumentation.recordSkipped("deployment_closed", { dseq, address, txHash: tx.hash });
        return;
      }

      this.logger.error({ event: "INITIAL_FUNDING_TX_FAILED", dseq, address, txHash: tx.hash, code: tx.code, rawLog: tx.rawLog });
      throw txError;
    }

    this.instrumentation.recordDeposit(amount, denom, { dseq, address, blockRate: deployment.blockRate });

    await this.scheduleWalletReload({ walletId, dseq, address });
  }

  /**
   * A runtime limit counts from lease start, not deployment creation, so bid selection doesn't eat
   * into the requested hours. The countdown starts before the sufficient-runway skip so a well-funded
   * new lease still anchors at lease start. The anchor is a set-if-unset, so job retries and the
   * top-up sweep's late fallback all agree on the deadline the first anchoring wrote.
   *
   * It also runs ahead of the auto-top-up gate that follows it. A limit with funding turned off is still a deadline
   * the user asked for, and the closer honours it by design, ignoring `autoTopUpEnabled`; but it only
   * sees deployments whose deadline is anchored, and the sweep's late fallback skips funding-off rows.
   * Anchoring here is what makes that deadline reachable at all.
   */
  private async startRuntimeCountdown(deploymentSetting: DeploymentSettingsOutput | undefined): Promise<Date | null> {
    if (!deploymentSetting?.runtimeLimitHours) {
      return null;
    }

    return deploymentSetting.runtimeEndsAt ?? (await this.deploymentSettingRepository.startRuntimeCountdown(deploymentSetting.id));
  }

  /**
   * The deposit is already final on-chain by the time we schedule the follow-up
   * wallet reload check, so a scheduling failure must not fail the funding job:
   * a retry would skip the now-funded deployment (sufficient runway) and
   * misreport a deposit failure. The failure log is best effort for the same
   * reason. The hourly top-up cron remains the safety net.
   */
  private async scheduleWalletReload({ walletId, dseq, address }: { walletId: number; dseq: string; address: string }): Promise<void> {
    try {
      await this.walletReloadJobService.scheduleImmediate({ walletId }, { triggeredByDeployment: true });
    } catch (error) {
      try {
        this.logger.error({ event: "INITIAL_FUNDING_WALLET_RELOAD_SCHEDULE_FAILED", walletId, dseq, address, error });
      } catch {
        return;
      }
    }
  }
}
