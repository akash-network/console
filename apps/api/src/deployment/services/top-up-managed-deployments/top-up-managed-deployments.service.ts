import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { DepositDeploymentMsgOptions, RpcMessageService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { needsCreditsLowTransition } from "@src/billing/services/wallet-credits-low-check/credits-low-transition";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentSettingRepository, type FundingClaim } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { AutoTopUpOwnerDeployments, DrainingDeployment } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";
import { CachedBalance, CachedBalanceService } from "../cached-balance/cached-balance.service";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import type { DeploymentTopUpInstrumentation } from "./deployment-top-up-instrumentation";
import { FundDrainingDeploymentsInstrumentationService } from "./fund-draining-deployments-instrumentation.service";
import { TopUpManagedDeploymentsInstrumentationService } from "./top-up-managed-deployments-instrumentation.service";

type CollectedMessage = {
  message: { typeUrl: string; value: MsgAccountDeposit };
  input: DepositDeploymentMsgOptions;
  deployment: DrainingDeployment;
};

@singleton()
export class TopUpManagedDeploymentsService {
  constructor(
    private readonly managedSignerService: ManagedSignerService,
    private readonly billingConfig: BillingConfigService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly rpcClientService: RpcMessageService,
    private readonly cachedBalanceService: CachedBalanceService,
    private readonly blockHttpService: BlockHttpService,
    private readonly chainErrorService: ChainErrorService,
    private readonly instrumentation: TopUpManagedDeploymentsInstrumentationService,
    private readonly fundDrainingInstrumentation: FundDrainingDeploymentsInstrumentationService,
    private readonly walletReloadService: WalletReloadJobService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentConfig: DeploymentConfigService,
    private readonly balancesService: BalancesService
  ) {}

  /**
   * The whole sweep is sized from a single block height: refetching per owner would make a deployment's
   * amount depend on where in the run its owner happens to fall, and would let the amount be derived from
   * a different height than the look-ahead window that admitted the deployment.
   */
  async topUpDeployments(options: DryRunOptions): Promise<Result<void, unknown[]>> {
    const currentHeight = await this.blockHttpService.getCurrentHeight();
    this.instrumentation.start(currentHeight, options);
    const errors: unknown[] = [];

    try {
      for await (const owner of this.drainingDeploymentService.findDrainingDeploymentsByOwner(currentHeight, options)) {
        try {
          if (owner.drainingDeployments.length) {
            const balance = await this.cachedBalanceService.get(owner.address);
            await this.#fundOwnerDeployments(
              { address: owner.address, walletId: owner.walletId, deployments: owner.drainingDeployments },
              options,
              balance,
              this.instrumentation,
              currentHeight
            );
          }
        } catch (error: unknown) {
          errors.push(error);
        } finally {
          if (!options.dryRun) {
            await this.#ensureCreditsLowTransitionChecked(owner, currentHeight);
          }
        }
      }
    } catch (error: unknown) {
      errors.push(error);
    } finally {
      const endHeight = await this.blockHttpService.getCurrentHeight().catch(() => undefined);
      this.instrumentation.finish(errors.length ? "failure" : "success", endHeight);
    }

    return errors.length > 0 ? Err(errors) : Ok(undefined);
  }

  /**
   * Funds a single owner's draining deployments immediately, reusing the cron's
   * per-owner path. Triggered off-cron the moment credits land so a deployment
   * about to drain does not wait up to an hour for the next scheduled pass.
   */
  async topUpDrainingDeploymentsForOwner({ walletId, address }: { walletId: number; address: string }): Promise<void> {
    try {
      const currentHeight = await this.blockHttpService.getCurrentHeight();
      const deployments = await this.drainingDeploymentService.findDrainingDeploymentsForOwner(address, this.fundDrainingInstrumentation, currentHeight);

      if (!deployments.length) {
        this.fundDrainingInstrumentation.recordSkipped({ owner: address, deploymentCount: 0 });
        return;
      }

      const balance = await this.cachedBalanceService.getFresh(address);
      await this.#fundOwnerDeployments({ address, walletId, deployments }, { dryRun: false }, balance, this.fundDrainingInstrumentation, currentHeight);
    } finally {
      await this.#scheduleCreditsLowCheckOnLandedCredits(walletId);
    }
  }

  /**
   * Credits just landed on this wallet, so the credits-low verdict may flip — typically clearing
   * the low stamp. Runs whether or not anything was draining, and best-effort: a schedule failure
   * must not fail the funding job after a landed deposit, where retries would burn against the
   * funding-claim cooldown.
   */
  async #scheduleCreditsLowCheckOnLandedCredits(walletId: number): Promise<void> {
    try {
      await this.walletReloadService.scheduleCreditsLowCheckIfAutoReloadOff({ walletId });
    } catch (error: unknown) {
      this.fundDrainingInstrumentation.recordCreditsLowScheduleError({ walletId, error });
    }
  }

  async #fundOwnerDeployments(
    { address, walletId, deployments }: { address: string; walletId: number; deployments: DrainingDeployment[] },
    options: DryRunOptions,
    balance: CachedBalance,
    instrumentation: DeploymentTopUpInstrumentation,
    currentHeight: number
  ): Promise<void> {
    if (options.dryRun) {
      const messageInputs = await this.collectMessages(deployments, balance, instrumentation, currentHeight);

      if (!messageInputs.length) {
        instrumentation.recordSkipped({ owner: address, deploymentCount: deployments.length });
        return;
      }

      await this.topUpForOwner(address, messageInputs, options, instrumentation);
      return;
    }

    const claims = await this.#claimForFunding(deployments);

    if (!claims.length) {
      instrumentation.recordSkipped({ owner: address, deploymentCount: deployments.length });
      return;
    }

    const claimedIds = new Set(claims.map(claim => claim.id));
    const messageInputs = await this.collectMessages(
      deployments.filter(deployment => claimedIds.has(deployment.id)),
      balance,
      instrumentation,
      currentHeight
    );
    const preparedIds = new Set(messageInputs.map(input => input.deployment.id));

    await this.#releaseFundingClaims(
      address,
      claims.filter(claim => !preparedIds.has(claim.id)),
      instrumentation
    );

    if (!messageInputs.length) {
      instrumentation.recordSkipped({ owner: address, deploymentCount: deployments.length });
      return;
    }

    let deposited = false;

    try {
      deposited = await this.topUpForOwner(address, messageInputs, options, instrumentation);
    } finally {
      if (!deposited) {
        await this.#releaseFundingClaims(
          address,
          claims.filter(claim => preparedIds.has(claim.id)),
          instrumentation
        );
      }
    }

    await this.walletReloadService.scheduleImmediate({ walletId });
  }

  /**
   * Best-effort: the sweep only schedules credits-low email checks, so failures here are
   * recorded and kept out of the funding run's status and result, which report on funding
   * alone. Runs after the funding attempt regardless of its outcome — an owner whose funding
   * just failed is among the most likely to be low. A funded owner is enqueued without an
   * inline verdict: the deposits just moved its balance, so the handler recomputes fresh state.
   */
  async #ensureCreditsLowTransitionChecked(owner: AutoTopUpOwnerDeployments, currentHeight: number): Promise<void> {
    try {
      if (owner.autoReloadEnabled || owner.isTrialing) {
        return;
      }

      if (owner.drainingDeployments.length || (await this.#needsCreditsLowTransition(owner, currentHeight))) {
        await this.walletReloadService.scheduleCreditsLowCheck(owner.userId, { withCleanup: true });
      }
    } catch (error: unknown) {
      this.instrumentation.recordCreditsLowScheduleError({ walletId: owner.walletId, error });

      try {
        await this.walletReloadService.scheduleCreditsLowCheck(owner.userId, { withCleanup: true });
      } catch {
        return;
      }
    }
  }

  /**
   * Decides from data already in hand whether the credits-low state machine needs to move;
   * anything enqueued is re-verified by the handler against fresh state, so a stale row here
   * costs at most a no-op job, and an evaluation failure falls back to enqueueing so the
   * handler's retries absorb transient errors. Compares in credits: `toFiatAmount` is
   * monotonic (identity for uact), so this matches the handler's USD comparison except
   * inside its cent-rounding band, where the mismatch is a harmless enqueue.
   */
  async #needsCreditsLowTransition(owner: AutoTopUpOwnerDeployments, currentHeight: number): Promise<boolean> {
    const isNotified = Boolean(owner.creditsLowNotifiedAt);
    const weeklyCredits = this.drainingDeploymentService.calculateWeeklyCoverageCredits(owner.activeDeployments, currentHeight);

    if (weeklyCredits === 0) {
      return needsCreditsLowTransition({ balance: 0, weeklyCost: 0, isNotified });
    }

    const balance = await this.balancesService.retrieveDeploymentLimit({ address: owner.address });

    return needsCreditsLowTransition({ balance, weeklyCost: weeklyCredits, isNotified });
  }

  /**
   * Claims before any balance math so a deployment another pass already funded never reserves a
   * share of the owner's shared allowance: reservations are not refundable, so a loser reserving
   * first leaves the winners of the same batch to be funded from a short-changed pool.
   */
  async #claimForFunding(deployments: DrainingDeployment[]): Promise<FundingClaim[]> {
    return await this.deploymentSettingRepository.claimForFunding(
      deployments.map(deployment => deployment.id),
      this.deploymentConfig.get("AUTO_TOP_UP_DEDUP_COOLDOWN_IN_MIN")
    );
  }

  /**
   * A release failure is reported rather than thrown: the release runs in a finally block, where a
   * rejection would replace the chain error the caller classifies to decide whether to retry.
   */
  async #releaseFundingClaims(owner: string, claims: FundingClaim[], instrumentation: DeploymentTopUpInstrumentation): Promise<void> {
    if (!claims.length) {
      return;
    }

    await this.deploymentSettingRepository.releaseFundingClaim(claims).catch((error: unknown) => {
      instrumentation.recordClaimReleaseError({ owner, deploymentIds: claims.map(claim => claim.id), error });
    });
  }

  private async collectMessages(
    deployments: DrainingDeployment[],
    balance: CachedBalance,
    instrumentation: DeploymentTopUpInstrumentation,
    currentHeight: number
  ): Promise<CollectedMessage[]> {
    const denom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");

    const messageInputs = await Promise.all(
      deployments.map(async deployment => {
        instrumentation.recordDeploymentPreparation(deployment.address, deployment.predictedClosedHeight);

        try {
          const desiredAmount = this.drainingDeploymentService.calculateAmountToTargetRunway(deployment, currentHeight);
          if (desiredAmount <= 0) {
            instrumentation.recordInvalidDepositAmount({
              desiredAmount,
              dseq: deployment.dseq,
              address: deployment.address,
              blockRate: deployment.blockRate
            });
            return;
          }
          const affordableAmount = balance.previewSufficientAmount(desiredAmount);
          const runwayMinutes = this.drainingDeploymentService.calculateRunwayMinutesAfterDeposit(deployment, affordableAmount, currentHeight);

          if (this.#isCappedBelowUsefulRunway({ desiredAmount, affordableAmount, runwayMinutes })) {
            instrumentation.recordDepositBelowUsefulRunway({
              dseq: deployment.dseq,
              address: deployment.address,
              desiredAmount,
              affordableAmount,
              runwayMinutes
            });
            return;
          }

          const sufficientAmount = balance.reserveSufficientAmount(desiredAmount);

          const messageInput: DepositDeploymentMsgOptions = {
            dseq: Number(deployment.dseq),
            amount: sufficientAmount,
            denom,
            owner: deployment.address,
            signer: deployment.address
          };

          const message = this.rpcClientService.getDepositDeploymentMsg(messageInput);

          return {
            message,
            input: messageInput,
            deployment
          };
        } catch (error: unknown) {
          instrumentation.recordMessagePreparationError({
            deployment,
            error
          });
        }
      })
    );

    return messageInputs.filter(x => !!x);
  }

  /**
   * A deposit capped by the credits available that buys less runway than the dedup cooldown is worse than
   * no deposit: it stamps a claim that locks the deployment out of funding for longer than the runway it
   * just bought, so credits landing in between cannot save it. Left unfunded, the deployment keeps its
   * claim free for the pass that runs the moment those credits land.
   *
   * Only capped deposits are declined. An uncapped one is the complete answer for the deployment however
   * small it is, which is what a runtime-limited deployment close to its deadline asks for. A deployment
   * the allowance cannot fund at all is left to `reserveSufficientAmount`, whose insufficient-balance
   * error is what drives the credits-low telemetry.
   */
  #isCappedBelowUsefulRunway({
    desiredAmount,
    affordableAmount,
    runwayMinutes
  }: {
    desiredAmount: number;
    affordableAmount: number;
    runwayMinutes: number;
  }): boolean {
    const isCapped = affordableAmount > 0 && affordableAmount < desiredAmount;

    return isCapped && runwayMinutes < this.deploymentConfig.get("AUTO_TOP_UP_DEDUP_COOLDOWN_IN_MIN");
  }

  private async topUpForOwner(
    owner: string,
    ownerInputs: CollectedMessage[],
    options: DryRunOptions,
    instrumentation: DeploymentTopUpInstrumentation
  ): Promise<boolean> {
    const walletId = ownerInputs[0].deployment.walletId;

    try {
      if (!options.dryRun) {
        const { address, walletIsTrialing: isTrialing, walletCreatedAt: createdAt, walletActivatedAt: activatedAt } = ownerInputs[0].deployment;
        const feeAllowance = await this.managedSignerService.ensureFeeGrants({ address, isTrialing, createdAt, activatedAt });

        if (feeAllowance <= 0) {
          instrumentation.recordChainTxError({
            owner,
            items: ownerInputs,
            error: new Error(`Fee grant missing for wallet ${owner}, unable to top up deployments`)
          });
          return false;
        }

        const tx = await this.managedSignerService.executeDerivedTx(
          walletId,
          ownerInputs.map(i => i.message)
        );

        if (tx.code !== COSMOS_TX_CODE_OK) {
          instrumentation.recordChainTxError({
            owner,
            items: ownerInputs,
            error: new Error(`Deposit tx ${tx.hash} failed on-chain with code ${tx.code}: ${tx.rawLog}`)
          });
          return false;
        }
      }
    } catch (error: unknown) {
      instrumentation.recordChainTxError({ owner, items: ownerInputs, error });

      if (error instanceof Error && (await this.chainErrorService.isMasterWalletInsufficientFundsError(error))) {
        instrumentation.recordMasterWalletInsufficientFundsError({ owner, items: ownerInputs, error });
        throw error;
      }

      return false;
    }

    this.#recordDeposit(instrumentation, { owner, items: ownerInputs });

    return true;
  }

  /**
   * The deposit has already landed on chain by the time it is recorded, so a telemetry failure must
   * not escape as a failed deposit: that would release the claim and let the next pass deposit again.
   */
  #recordDeposit(instrumentation: DeploymentTopUpInstrumentation, details: { owner: string; items: CollectedMessage[] }): void {
    try {
      instrumentation.recordDeposit(details);
    } catch {
      return;
    }
  }
}
