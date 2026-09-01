import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { millisecondsInMinute } from "date-fns/constants";
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
import type { DeploymentTopUpInstrumentation, OwnerInsufficientBalanceItem } from "./deployment-top-up-instrumentation";
import { FundDrainingDeploymentsInstrumentationService } from "./fund-draining-deployments-instrumentation.service";
import { TopUpManagedDeploymentsInstrumentationService } from "./top-up-managed-deployments-instrumentation.service";

/** Bounds how long one owner's backlog of closed deployments can hold the sweep, which converges over the passes that follow. */
const MAX_CLOSED_DEPLOYMENT_DROPS = 3;

type DepositSize = {
  affordableAmount: number;
  runwayMinutes: number;
};

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
      for await (const owner of this.drainingDeploymentService.findDrainingDeploymentsByOwner(currentHeight, this.instrumentation, options)) {
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

  /** Best-effort after a landed deposit: failing the job here would burn a retry against the funding-claim cooldown. */
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
    if (balance.spendable <= 0) {
      this.#skipOwnerWithoutSpendableBalance({ address, deployments }, balance, instrumentation, currentHeight);
      return;
    }

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

    const preparedClaims = claims.filter(claim => preparedIds.has(claim.id));
    let deposited = false;

    try {
      deposited = await this.topUpForOwner(address, messageInputs, options, instrumentation);
    } finally {
      await this.#releaseFundingClaims(
        address,
        deposited ? this.#runtimeCappedClaims(preparedClaims, messageInputs, currentHeight) : preparedClaims,
        instrumentation
      );
    }

    await this.walletReloadService.scheduleImmediate({ walletId });
  }

  /** Runs after the funding attempt whatever its outcome, since an owner whose funding just failed is among the likeliest to be low. */
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

  /** Safe to answer from stale rows: the handler re-verifies anything enqueued against fresh state, so a wrong yes costs a no-op job. */
  async #needsCreditsLowTransition(owner: AutoTopUpOwnerDeployments, currentHeight: number): Promise<boolean> {
    const isNotified = Boolean(owner.creditsLowNotifiedAt);
    const weeklyCredits = this.drainingDeploymentService.calculateWeeklyCoverageCredits(owner.activeDeployments, currentHeight);

    if (weeklyCredits === 0) {
      return needsCreditsLowTransition({ balance: 0, weeklyCost: 0, isNotified });
    }

    const balance = await this.balancesService.retrieveDeploymentLimit({ address: owner.address });

    return needsCreditsLowTransition({ balance, weeklyCost: weeklyCredits, isNotified });
  }

  /** Mirrors the preparation loop's telemetry without claiming rows, so the cooldown filter here must keep matching the claim query's. */
  #skipOwnerWithoutSpendableBalance(
    { address, deployments }: { address: string; deployments: DrainingDeployment[] },
    balance: CachedBalance,
    instrumentation: DeploymentTopUpInstrumentation,
    currentHeight: number
  ): void {
    const insufficient: OwnerInsufficientBalanceItem[] = [];

    for (const deployment of this.#filterClaimable(deployments)) {
      instrumentation.recordDeploymentPreparation(deployment.address, deployment.predictedClosedHeight);

      const desiredAmount = this.drainingDeploymentService.calculateAmountToTargetRunway(deployment, currentHeight);

      if (desiredAmount <= 0) {
        instrumentation.recordInvalidDepositAmount({
          desiredAmount,
          dseq: deployment.dseq,
          address: deployment.address,
          blockRate: deployment.blockRate
        });
        continue;
      }

      insufficient.push({ deployment, desiredAmount });
    }

    if (insufficient.length) {
      instrumentation.recordOwnerInsufficientBalance({ owner: address, spendable: balance.spendable, deployments: insufficient });
    }

    instrumentation.recordSkipped({ owner: address, deploymentCount: deployments.length });
  }

  #filterClaimable(deployments: DrainingDeployment[]): DrainingDeployment[] {
    const cooldownMs = this.deploymentConfig.get("AUTO_TOP_UP_DEDUP_COOLDOWN_IN_MIN") * millisecondsInMinute;
    const claimableBefore = new Date(Date.now() - cooldownMs);

    return deployments.filter(deployment => !deployment.lastFundedAt || deployment.lastFundedAt < claimableBefore);
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

  /** A deposit the runtime limit shortened must not hold the cooldown, or a user extending that limit goes unfunded until the claim ages out. */
  #runtimeCappedClaims(preparedClaims: FundingClaim[], messageInputs: CollectedMessage[], currentHeight: number): FundingClaim[] {
    const cappedIds = new Set(
      messageInputs.filter(input => this.drainingDeploymentService.isCappedByRuntimeLimit(input.deployment, currentHeight)).map(input => input.deployment.id)
    );

    return preparedClaims.filter(claim => cappedIds.has(claim.id));
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
          const { affordableAmount, runwayMinutes } = this.#sizeDeposit({ balance, deployment, desiredAmount, currentHeight, instrumentation });

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

  /** The floor must never be the reason a deposit is not made, so it yields when the floored amount falls short. */
  #sizeDeposit({
    balance,
    deployment,
    desiredAmount,
    currentHeight,
    instrumentation
  }: {
    balance: CachedBalance;
    deployment: DrainingDeployment;
    desiredAmount: number;
    currentHeight: number;
    instrumentation: DeploymentTopUpInstrumentation;
  }): DepositSize {
    const floored = this.#describeDeposit({ deployment, currentHeight, affordableAmount: balance.previewSufficientAmount(desiredAmount) });

    if (!this.#fallsShortOfUsefulDeposit({ desiredAmount, ...floored })) {
      return floored;
    }

    const conceded = this.#describeDeposit({
      deployment,
      currentHeight,
      affordableAmount: balance.previewSufficientAmountWithoutHeadroom(desiredAmount)
    });

    if (this.#fallsShortOfUsefulDeposit({ desiredAmount, ...conceded })) {
      return floored;
    }

    balance.waiveHeadroom();

    instrumentation.recordHeadroomConceded({
      dseq: deployment.dseq,
      address: deployment.address,
      desiredAmount,
      flooredAmount: floored.affordableAmount,
      affordableAmount: conceded.affordableAmount,
      runwayMinutes: conceded.runwayMinutes
    });

    return conceded;
  }

  /** An amount of zero falls short too: insufficient balance is the right answer only once the floor has yielded. */
  #fallsShortOfUsefulDeposit(deposit: { desiredAmount: number; affordableAmount: number; runwayMinutes: number }): boolean {
    return deposit.affordableAmount <= 0 || this.#isCappedBelowUsefulRunway(deposit);
  }

  #describeDeposit({
    deployment,
    affordableAmount,
    currentHeight
  }: {
    deployment: DrainingDeployment;
    affordableAmount: number;
    currentHeight: number;
  }): DepositSize {
    return {
      affordableAmount,
      runwayMinutes: this.drainingDeploymentService.calculateRunwayMinutesAfterDeposit(deployment, affordableAmount, currentHeight)
    };
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

  /**
   * Re-broadcasting without a closed deployment is safe only because both classified shapes prove the tx was
   * rejected whole: a fee estimation never broadcasts, and a non-zero tx code means every message reverted.
   * The closed deployment keeps the balance it reserved, which only leaves the survivors a smaller allowance
   * than they were already sized against before the batch was sent.
   */
  private async topUpForOwner(
    owner: string,
    ownerInputs: CollectedMessage[],
    options: DryRunOptions,
    instrumentation: DeploymentTopUpInstrumentation
  ): Promise<boolean> {
    if (options.dryRun) {
      this.#recordDeposit(instrumentation, { owner, items: ownerInputs });
      return true;
    }

    const { address, walletIsTrialing: isTrialing, walletCreatedAt: createdAt, walletActivatedAt: activatedAt } = ownerInputs[0].deployment;
    let feeAllowance: number;

    try {
      feeAllowance = await this.managedSignerService.ensureFeeGrants({ address, isTrialing, createdAt, activatedAt });
    } catch (error: unknown) {
      await this.#recordOwnerFundingFailure({ owner, items: ownerInputs, error, instrumentation });
      return false;
    }

    if (feeAllowance <= 0) {
      instrumentation.recordChainTxError({
        owner,
        items: ownerInputs,
        error: new Error(`Fee grant missing for wallet ${owner}, unable to top up deployments`)
      });
      return false;
    }

    const walletId = ownerInputs[0].deployment.walletId;
    let remaining = ownerInputs;
    let closedDeploymentsDropped = 0;

    while (remaining.length) {
      const failure = await this.#depositForOwner(walletId, remaining);

      if (!failure) {
        this.#recordDeposit(instrumentation, { owner, items: remaining });
        return true;
      }

      const closedIndex = this.chainErrorService.getClosedDeploymentMessageIndex(failure, remaining.length);

      if (closedIndex === undefined) {
        await this.#recordOwnerFundingFailure({ owner, items: remaining, error: failure, instrumentation });
        return false;
      }

      await this.#markDeploymentClosed({ owner, item: remaining[closedIndex], messageIndex: closedIndex, error: failure, instrumentation });
      remaining = remaining.filter((_, index) => index !== closedIndex);

      if (++closedDeploymentsDropped >= MAX_CLOSED_DEPLOYMENT_DROPS && remaining.length) {
        instrumentation.recordClosedDeploymentRetryLimit({ owner, remainingCount: remaining.length });
        return false;
      }
    }

    return false;
  }

  /** Runs the master-wallet classification for every failure that stops an owner's funding, whichever chain call raised it. */
  async #recordOwnerFundingFailure({
    owner,
    items,
    error,
    instrumentation
  }: {
    owner: string;
    items: CollectedMessage[];
    error: unknown;
    instrumentation: DeploymentTopUpInstrumentation;
  }): Promise<void> {
    instrumentation.recordChainTxError({ owner, items, error });

    if (error instanceof Error && (await this.chainErrorService.isMasterWalletInsufficientFundsError(error))) {
      instrumentation.recordMasterWalletInsufficientFundsError({ owner, items, error });
      throw error;
    }
  }

  /** Returns the failure rather than throwing it so the caller classifies a rejected estimate and a reverted tx alike. */
  async #depositForOwner(walletId: number, items: CollectedMessage[]): Promise<unknown> {
    try {
      const tx = await this.managedSignerService.executeDerivedTx(
        walletId,
        items.map(item => item.message)
      );

      if (tx.code !== COSMOS_TX_CODE_OK) {
        return new Error(`Deposit tx ${tx.hash} failed on-chain with code ${tx.code}: ${tx.rawLog}`);
      }

      return undefined;
    } catch (error: unknown) {
      return error;
    }
  }

  /** A failed write is reported rather than thrown, which would strand the survivors the retry exists to fund. */
  async #markDeploymentClosed({
    owner,
    item,
    messageIndex,
    error,
    instrumentation
  }: {
    owner: string;
    item: CollectedMessage;
    messageIndex: number;
    error: unknown;
    instrumentation: DeploymentTopUpInstrumentation;
  }): Promise<void> {
    try {
      await this.deploymentSettingRepository.markAsClosed([item.deployment.id]);
    } catch (markError: unknown) {
      instrumentation.recordDeploymentCloseMarkFailed({ owner, deployment: item.deployment, error: markError });
      return;
    }

    instrumentation.recordDeploymentClosedOnChain({ owner, deployment: item.deployment, messageIndex, error });
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
