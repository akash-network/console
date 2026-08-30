import { AnyAbility } from "@casl/ability";
import { millisecondsInHour, minutesInHour } from "date-fns/constants";
import keyBy from "lodash/keyBy";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { AutoTopUpDeployment, DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { ActiveLeaseRate, DrainingDeployment } from "@src/deployment/types/draining-deployment";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { DeploymentCloseJobService } from "../deployment-close-job/deployment-close-job.service";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DrainingDeploymentRpcService } from "../draining-deployment-rpc/draining-deployment-rpc.service";
import type { DeploymentTopUpInstrumentation } from "../top-up-managed-deployments/deployment-top-up-instrumentation";

export type { DrainingDeployment } from "@src/deployment/types/draining-deployment";

export type WeeklyCoverage = {
  weeklyCostUsd: number;
  cumulativeDailyCostsUsd: number[];
  /** Distinguishes a zero cost the database is certain of from one a chain read could have gotten wrong. */
  hasAutoTopUpSettings: boolean;
};

export type WeeklyBurnSource = Pick<DrainingDeployment, "blockRate"> & Partial<Pick<AutoTopUpDeployment, "runtimeLimitHours" | "runtimeEndsAt">>;

export type AutoTopUpOwnerDeployments = {
  address: string;
  walletId: number;
  userId: string;
  autoReloadEnabled: boolean;
  isTrialing: boolean;
  creditsLowNotifiedAt: Date | null;
  activeDeployments: DrainingDeployment[];
  drainingDeployments: DrainingDeployment[];
};

/** Hours in the seven-day window every weekly spending figure is quoted over. */
const WEEK_HOURS = 24 * 7;

@singleton()
export class DrainingDeploymentService {
  private readonly loggerService: ReturnType<CreateLogger>;

  constructor(
    private readonly blockHttpService: BlockHttpService,
    private readonly leaseRepository: LeaseRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentCloseJobService: DeploymentCloseJobService,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger,
    private readonly rpcService: DrainingDeploymentRpcService,
    private readonly balancesService: BalancesService
  ) {
    this.loggerService = createLogger({ context: DrainingDeploymentService.name });
  }

  /** Yields owners with nothing draining too, so the sweep can price their credits-low coverage without re-querying per owner. */
  async *findDrainingDeploymentsByOwner(
    currentHeight: number,
    instrumentation: DeploymentTopUpInstrumentation,
    options: DryRunOptions = { dryRun: false }
  ): AsyncGenerator<AutoTopUpOwnerDeployments> {
    for await (const { address, walletId, deploymentSettings } of this.deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively()) {
      const { activeDeployments, drainingDeployments } = await this.#resolveOwnerDeployments(
        deploymentSettings,
        address,
        currentHeight,
        instrumentation,
        options.dryRun
      );

      yield {
        address,
        walletId,
        userId: deploymentSettings[0].userId,
        autoReloadEnabled: deploymentSettings[0].isWalletAutoTopUpEnabled,
        isTrialing: deploymentSettings[0].walletIsTrialing,
        creditsLowNotifiedAt: deploymentSettings[0].walletCreditsLowNotifiedAt,
        activeDeployments,
        drainingDeployments
      };
    }
  }

  /**
   * Finds the active draining deployments for a single owner, applying the same
   * look-ahead window, auto-top-up gate, and closed-marking as the cron sweep.
   * Backs the event-driven immediate funding triggered when credits land.
   */
  async findDrainingDeploymentsForOwner(
    address: string,
    instrumentation: DeploymentTopUpInstrumentation,
    currentHeight: number
  ): Promise<DrainingDeployment[]> {
    const deploymentSettings = await this.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner(address);
    const { drainingDeployments } = await this.#resolveOwnerDeployments(deploymentSettings, address, currentHeight, instrumentation, false);

    return drainingDeployments;
  }

  #getExpectedClosureHeight(currentHeight: number): number {
    return Math.floor(currentHeight + averageBlockCountInAnHour * this.config.get("AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H"));
  }

  async #resolveOwnerDeployments(
    deploymentSettings: AutoTopUpDeployment[],
    address: string,
    currentHeight: number,
    instrumentation: DeploymentTopUpInstrumentation,
    dryRun: boolean
  ): Promise<{ activeDeployments: DrainingDeployment[]; drainingDeployments: DrainingDeployment[] }> {
    const expectedClosureHeight = this.#getExpectedClosureHeight(currentHeight);
    const activeDeployments = await this.#resolveActiveDeployments(deploymentSettings, address, instrumentation, dryRun);
    const drainingDeployments = await this.#dropDeploymentsFundedToRuntimeLimit(
      activeDeployments.filter(deployment => deployment.predictedClosedHeight <= expectedClosureHeight),
      currentHeight,
      instrumentation,
      dryRun
    );

    return { activeDeployments, drainingDeployments };
  }

  async #resolveActiveDeployments(
    deploymentSettings: AutoTopUpDeployment[],
    address: string,
    instrumentation: DeploymentTopUpInstrumentation,
    dryRun: boolean
  ): Promise<DrainingDeployment[]> {
    if (deploymentSettings.length === 0) {
      return [];
    }

    const dseqs = deploymentSettings.map(deployment => deployment.dseq);
    const leases = await this.findLeases(Number.MAX_SAFE_INTEGER, address, dseqs);

    if (!leases.length) {
      return [];
    }

    const byDseqOwner = keyBy(leases, "dseq");
    const [active, missingIds] = deploymentSettings.reduce<[DrainingDeployment[], string[]]>(
      (acc, deploymentSetting) => {
        const deployment = byDseqOwner[Number(deploymentSetting.dseq)];

        if (!deployment) {
          return acc;
        }

        if (deployment.isClosed || deployment.closedHeight) {
          acc[1].push(deploymentSetting.id);
        } else {
          acc[0].push({
            ...deploymentSetting,
            predictedClosedHeight: deployment.predictedClosedHeight,
            blockRate: deployment.blockRate
          });
        }
        return acc;
      },
      [[], []]
    );

    if (missingIds.length && !dryRun) {
      await this.deploymentSettingRepository.markAsClosed(missingIds);
      instrumentation.recordDeploymentsMarkedClosed(missingIds.length);
    }

    return active;
  }

  /**
   * Drops runtime-limited deployments already funded up to their deadline before claims are taken,
   * so they drain and close on chain instead of burning claim churn and non-positive-amount telemetry
   * on every sweep of their final window. Deployments the initial-funding job never anchored (it
   * failed or raced) get their countdown started here, inside the look-ahead window, late, which
   * only errs toward extra runtime. A dry run uses an in-memory deadline and does not persist one.
   */
  async #dropDeploymentsFundedToRuntimeLimit(
    deployments: DrainingDeployment[],
    currentHeight: number,
    instrumentation: DeploymentTopUpInstrumentation,
    dryRun: boolean
  ): Promise<DrainingDeployment[]> {
    const fundable: DrainingDeployment[] = [];

    for (const deployment of deployments) {
      if (!deployment.runtimeLimitHours) {
        fundable.push(deployment);
        continue;
      }

      const runtimeEndsAt = deployment.runtimeEndsAt ?? (await this.#startRuntimeCountdown(deployment, deployment.runtimeLimitHours, dryRun));

      if (!runtimeEndsAt) {
        fundable.push(deployment);
        continue;
      }

      if (this.#isFundedToRuntimeLimit(deployment.predictedClosedHeight, runtimeEndsAt, currentHeight)) {
        instrumentation.recordRuntimeLimitReached({ dseq: deployment.dseq, address: deployment.address, runtimeEndsAt });
        continue;
      }

      fundable.push({ ...deployment, runtimeEndsAt });
    }

    return fundable;
  }

  /**
   * Anchors a deadline the initial-funding job never got to, and gives it the close job that anchoring
   * owes it. Only a first anchor schedules here: a deployment already carrying a deadline already has
   * its job, and one whose job went missing is picked back up by the hourly reconcile rather than being
   * rescheduled on every sweep.
   *
   * The scheduling is best-effort, because throwing would cost more than it buys. The anchor is already
   * committed, so a retry of this sweep takes the already-anchored path and never reaches the schedule
   * again; all a throw would do is abandon funding for the rest of this owner's deployments. The hourly
   * reconcile picks the deployment up once its deadline passes, which is the same guarantee it gives
   * every other way a job can go missing.
   */
  async #startRuntimeCountdown(deployment: DrainingDeployment, runtimeLimitHours: number, dryRun: boolean): Promise<Date | null> {
    if (dryRun) {
      return new Date(Date.now() + runtimeLimitHours * millisecondsInHour);
    }

    const runtimeEndsAt = await this.deploymentSettingRepository.startRuntimeCountdown(deployment.id);

    if (runtimeEndsAt) {
      try {
        await this.deploymentCloseJobService.schedule(
          { deploymentSettingId: deployment.id, userId: deployment.userId, dseq: deployment.dseq },
          { startAfter: runtimeEndsAt, withCleanup: true }
        );
      } catch (error) {
        this.loggerService.error({ event: "LATE_ANCHOR_CLOSE_JOB_SCHEDULE_FAILED", dseq: deployment.dseq, address: deployment.address, error });
      }
    }

    return runtimeEndsAt;
  }

  #isFundedToRuntimeLimit(predictedClosedHeight: number, runtimeEndsAt: Date, currentHeight: number): boolean {
    const predicted = Number(predictedClosedHeight);
    const fundedUntil = Math.max(currentHeight, Number.isFinite(predicted) ? predicted : currentHeight);

    return this.#getRuntimeLimitHeight(runtimeEndsAt, currentHeight) <= fundedUntil;
  }

  #getRuntimeLimitHeight(runtimeEndsAt: Date, currentHeight: number): number {
    const hoursUntilRuntimeEnds = (runtimeEndsAt.getTime() - Date.now()) / millisecondsInHour;

    return currentHeight + averageBlockCountInAnHour * hoursUntilRuntimeEnds;
  }

  /**
   * Estimates what a single automatic funding event costs for a specific deployment and user.
   * Looks up the user's wallet and lease, then reports the steady-state per-event amount.
   *
   * @param dseq - Deployment sequence number
   * @param userId - User ID to look up wallet for
   * @returns Estimated top-up amount in credits, or 0 if user wallet or deployment not found
   */
  async calculateTopUpAmountForDseqAndUserId(dseq: string, userId: string): Promise<number> {
    const userWallet = await this.userWalletRepository.findOneByUserId(userId);

    if (!userWallet) {
      return 0;
    }

    const deploymentSetting = await this.leaseRepository.findOneByDseqAndOwner(dseq, userWallet.address!);

    if (!deploymentSetting) {
      return 0;
    }

    return this.calculateSteadyStateTopUpAmount(deploymentSetting);
  }

  /**
   * Funds a deployment up to the target runway, counting the runway its escrow already covers, so a
   * deployment never holds more than the target. Funding only triggers once a deployment drops inside
   * the look-ahead window, so the amount is at least the gap between the window and the target.
   *
   * A deployment whose escrow already ran out is in arrears on chain, but the funded-until floor is
   * `currentHeight` rather than the overdue height: a stale `predictedClosedHeight` far in the past
   * would otherwise size a huge deposit. Such a deployment reaches slightly less than the target and
   * the next sweep tops up the remainder.
   *
   * A runtime-limited deployment's target is additionally clamped to its deadline, so no deposit ever
   * buys runway past the limit and the final deposit covers exactly the remaining runtime.
   *
   * @param deployment - Deployment with its block rate, predicted closure height, and optional runtime deadline
   * @param currentHeight - Block height the funding run is scoped to
   * @returns Top-up amount in credits, or 0 when the deployment already holds the target
   */
  calculateAmountToTargetRunway(
    deployment: Pick<DrainingDeploymentOutput, "blockRate" | "predictedClosedHeight"> & { runtimeEndsAt?: Date | null },
    currentHeight: number
  ): number {
    const blockRate = Number(deployment.blockRate);
    const predictedClosedHeight = Number(deployment.predictedClosedHeight);
    const isUsable = Number.isFinite(blockRate) && blockRate > 0 && Number.isFinite(predictedClosedHeight);

    if (!isUsable) {
      return 0;
    }

    const runwayTargetHeight = this.#getRunwayTargetHeight(currentHeight);
    const targetHeight = deployment.runtimeEndsAt
      ? Math.min(runwayTargetHeight, this.#getRuntimeLimitHeight(deployment.runtimeEndsAt, currentHeight))
      : runwayTargetHeight;
    const fundedUntil = Math.max(currentHeight, predictedClosedHeight);

    return Math.max(0, Math.floor(blockRate * (targetHeight - fundedUntil)));
  }

  /** A deposit the runtime limit shortened must not hold the funding cooldown, or extending that limit goes unfunded until the claim ages out. */
  isCappedByRuntimeLimit(deployment: { runtimeEndsAt?: Date | null }, currentHeight: number): boolean {
    if (!deployment.runtimeEndsAt) {
      return false;
    }

    return this.#getRuntimeLimitHeight(deployment.runtimeEndsAt, currentHeight) < this.#getRunwayTargetHeight(currentHeight);
  }

  #getRunwayTargetHeight(currentHeight: number): number {
    return currentHeight + averageBlockCountInAnHour * this.config.get("AUTO_TOP_UP_TARGET_RUNWAY_IN_H");
  }

  /**
   * Minutes of runway a deployment holds once a deposit of `amount` lands, counting the runway its escrow
   * already covers. Shares `calculateAmountToTargetRunway`'s funded-until floor, so a deployment already
   * in arrears is credited only the runway the deposit itself buys.
   *
   * @param deployment - Deployment with its block rate and predicted closure height
   * @param amount - Deposit amount in credits
   * @param currentHeight - Block height the funding run is scoped to
   * @returns Minutes of runway after the deposit, or 0 when the deployment's block rate is unusable
   */
  calculateRunwayMinutesAfterDeposit(
    deployment: Pick<DrainingDeploymentOutput, "blockRate" | "predictedClosedHeight">,
    amount: number,
    currentHeight: number
  ): number {
    const blockRate = Number(deployment.blockRate);
    const predictedClosedHeight = Number(deployment.predictedClosedHeight);
    const isUsable = Number.isFinite(blockRate) && blockRate > 0 && Number.isFinite(predictedClosedHeight);

    if (!isUsable) {
      return 0;
    }

    const fundedUntil = Math.max(currentHeight, predictedClosedHeight);
    const runwayBlocks = fundedUntil - currentHeight + amount / blockRate;

    return (runwayBlocks / averageBlockCountInAnHour) * minutesInHour;
  }

  /**
   * The amount a funding event deposits once a deployment is in the funded steady state: it drains from
   * the target runway down to the look-ahead window before the next event tops it back up to the target.
   * Reported to users as the estimated per-event cost, so it stays a stable function of configuration
   * rather than of a deployment's current escrow, which would read as zero right after a top-up.
   *
   * @param deployment - Deployment with block rate information
   * @returns Estimated top-up amount in credits
   */
  calculateSteadyStateTopUpAmount(deployment: Pick<DrainingDeploymentOutput, "blockRate">): number {
    const hoursPerEvent = this.config.get("AUTO_TOP_UP_TARGET_RUNWAY_IN_H") - this.config.get("AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H");

    return Math.floor(Number(deployment.blockRate) * averageBlockCountInAnHour * hoursPerEvent);
  }

  /**
   * Calculates the unfunded cost for all deployments that would close before the target date.
   * For each draining deployment, computes the cost from its predicted close height (when escrow runs out)
   * to the target height — i.e. only the portion not already covered by escrow.
   * Deployments whose escrow lasts beyond the target date are excluded (they don't need additional funding).
   * Runtime-limited deployments are assumed to run to the target date too, so the estimate overstates
   * slightly for a deployment whose limit lands before the target — an accepted over-reservation.
   *
   * @param address - The address to calculate the deployment costs for
   * @param targetDate - The target date to calculate the costs until and till which deployments would close
   * @returns The unfunded cost (in credits) needed to keep all draining deployments running until the target date
   */
  async calculateAllDeploymentCostUntilDate(address: string, targetDate: Date): Promise<number> {
    const deploymentSettings = await this.#findAutoTopUpDeploymentSettings(address);

    if (deploymentSettings.length === 0) {
      return 0;
    }

    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const now = new Date();

    const hoursUntilTarget = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const targetHeight = Math.floor(currentHeight + averageBlockCountInAnHour * hoursUntilTarget);
    const drainingDeployments = await this.#findDrainingDeployments(deploymentSettings, address, targetHeight);

    return await this.#accumulateDeploymentCost(drainingDeployments, ({ predictedClosedHeight, blockRate }) => {
      if (predictedClosedHeight && predictedClosedHeight >= currentHeight && predictedClosedHeight <= targetHeight) {
        const blocksNeeded = targetHeight - predictedClosedHeight;
        return Math.floor(blockRate * blocksNeeded);
      }
      return 0;
    });
  }

  /** CASL scopes only the wallet lookup; the coverage query below is unscoped, which the already-proven-owned address makes safe. */
  async calculateWeeklyDeploymentCost(userId: string, ability: AnyAbility): Promise<number> {
    const userWallet = await this.userWalletRepository.accessibleBy(ability, "read").findOneByUserId(userId);

    if (!userWallet?.address) {
      return 0;
    }

    const { weeklyCostUsd } = await this.calculateWeeklyCoverageForAddress(userWallet.address);

    return weeklyCostUsd;
  }

  /**
   * Weekly auto-top-up coverage for an address, in USD.
   * Caps each runtime-limited deployment at remaining hours (or the unanchored
   * limit) so a deadline inside the week is not billed as a full seven days.
   * `cumulativeDailyCostsUsd[d - 1]` is what the first `d` days of that coverage cost, so a
   * balance can be translated into covered days without assuming the capped weekly total
   * is a uniform seven-day burn rate.
   * Not CASL-scoped — the credits-low job calls this with the wallet address.
   * Bills a deployment whose escrow has run dry too, since it keeps running on auto top-up.
   */
  async calculateWeeklyCoverageForAddress(address: string): Promise<WeeklyCoverage> {
    const deploymentSettings = await this.#findAutoTopUpDeploymentSettings(address);
    if (deploymentSettings.length === 0) {
      return { weeklyCostUsd: 0, cumulativeDailyCostsUsd: [], hasAutoTopUpSettings: false };
    }

    const noCoverage: WeeklyCoverage = { weeklyCostUsd: 0, cumulativeDailyCostsUsd: [], hasAutoTopUpSettings: true };
    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const leaseRates = await this.#findActiveLeaseRates(
      address,
      deploymentSettings.map(deployment => deployment.dseq)
    );
    const burns = this.#buildWeeklyBurns(this.#applySettingsToLeaseRates(deploymentSettings, leaseRates, address), currentHeight);

    const weeklyCredits = this.#creditsForHours(burns, WEEK_HOURS);
    if (weeklyCredits === 0) {
      return noCoverage;
    }

    const weeklyCostUsd = await this.balancesService.toFiatAmount(weeklyCredits);
    const cumulativeDailyCostsUsd = Array.from({ length: 7 }, (_, day) => (this.#creditsForHours(burns, (day + 1) * 24) / weeklyCredits) * weeklyCostUsd);

    return { weeklyCostUsd, cumulativeDailyCostsUsd, hasAutoTopUpSettings: true };
  }

  /** Joins on the numeric value of a dseq, since the two lease-rate sources differ on whether they keep its leading zeros. */
  #applySettingsToLeaseRates(deploymentSettings: AutoTopUpDeployment[], leaseRates: ActiveLeaseRate[], address: string): WeeklyBurnSource[] {
    const settingsByDseq = keyBy(deploymentSettings, setting => String(Number(setting.dseq)));

    return leaseRates.flatMap(leaseRate => {
      const setting = settingsByDseq[String(Number(leaseRate.dseq))];

      if (!setting) {
        this.loggerService.warn({ event: "ACTIVE_LEASE_RATE_WITHOUT_SETTING", dseq: leaseRate.dseq, address });
        return [];
      }

      return [{ ...setting, blockRate: leaseRate.blockRate }];
    });
  }

  /** Comparing this against a credit balance stands in for the handler's USD test: `toFiatAmount` is monotonic, off by at most its cent rounding. */
  calculateWeeklyCoverageCredits(deployments: WeeklyBurnSource[], currentHeight: number): number {
    return this.#creditsForHours(this.#buildWeeklyBurns(deployments, currentHeight), WEEK_HOURS);
  }

  #buildWeeklyBurns(deployments: WeeklyBurnSource[], currentHeight: number): Array<{ hourlyCredits: number; coverageHours: number }> {
    return deployments.flatMap(deployment => {
      if (!Number.isFinite(deployment.blockRate) || deployment.blockRate <= 0) {
        return [];
      }

      const coverageHours = this.#coverageHoursForDeployment(deployment, currentHeight);
      return coverageHours > 0 ? [{ hourlyCredits: deployment.blockRate * averageBlockCountInAnHour, coverageHours }] : [];
    });
  }

  #creditsForHours(burns: Array<{ hourlyCredits: number; coverageHours: number }>, hours: number): number {
    return burns.reduce((total, burn) => total + Math.floor(burn.hourlyCredits * Math.min(hours, burn.coverageHours)), 0);
  }

  /**
   * A week of coverage unless the setting has a runtime limit, then remaining
   * hours (0 if the deadline has passed). An unanchored limit is the remaining hours.
   */
  #coverageHoursForDeployment(setting: Partial<Pick<AutoTopUpDeployment, "runtimeLimitHours" | "runtimeEndsAt">>, currentHeight: number): number {
    if (setting.runtimeEndsAt) {
      const remainingHours = (this.#getRuntimeLimitHeight(setting.runtimeEndsAt, currentHeight) - currentHeight) / averageBlockCountInAnHour;
      return remainingHours <= 0 ? 0 : Math.min(WEEK_HOURS, remainingHours);
    }

    if (setting.runtimeLimitHours != null) {
      return Math.min(WEEK_HOURS, setting.runtimeLimitHours);
    }

    return WEEK_HOURS;
  }

  /**
   * Finds auto top-up deployment settings for a given address.
   * Validates that the user wallet exists and has an address before querying.
   *
   * @param address - The wallet address to find deployment settings for
   * @returns Array of auto top-up deployment settings, or empty array if wallet not found
   */
  async #findAutoTopUpDeploymentSettings(address: string): Promise<AutoTopUpDeployment[]> {
    const userWallet = await this.userWalletRepository.findOneBy({ address });

    if (!userWallet?.address) {
      return [];
    }

    return this.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner(address);
  }

  /**
   * Finds draining deployments for the given deployment settings.
   * Extracts dseqs from settings and queries leases using the current height as closure height.
   *
   * @param deploymentSettings - Array of auto top-up deployment settings
   * @param address - The owner address to query deployments for
   * @param closureHeight - Current block height to use as closure height threshold
   * @returns Array of draining deployment outputs
   */
  async #findDrainingDeployments(deploymentSettings: AutoTopUpDeployment[], address: string, closureHeight: number): Promise<DrainingDeploymentOutput[]> {
    const dseqs = deploymentSettings.map(deployment => deployment.dseq);
    return await this.findLeases(closureHeight, address, dseqs);
  }

  /**
   * Accumulates deployment costs by applying a callback function to each deployment.
   * Sums up the cost values returned by the callback for all deployments.
   *
   * @param drainingDeployments - Array of draining deployment outputs to process
   * @param callback - Async function that calculates cost for a single deployment
   * @returns Total accumulated cost across all deployments
   */
  async #accumulateDeploymentCost(
    drainingDeployments: DrainingDeploymentOutput[],
    callback: (deployment: DrainingDeploymentOutput) => number
  ): Promise<number> {
    let totalAmount = 0;
    for (const deployment of drainingDeployments) {
      totalAmount += callback(deployment);
    }
    return totalAmount;
  }

  /**
   * Finds leases for draining deployments, falling back to database if RPC fails.
   * Attempts to fetch from RPC service first, then falls back to database
   * repository if the RPC call fails.
   *
   * @param closureHeight - The block height threshold for filtering draining deployments
   * @param owner - The owner address to query deployments for
   * @param dseqs - Array of deployment sequence numbers to filter by
   * @returns Array of draining deployment outputs
   */
  async findLeases(closureHeight: number, owner: string, dseqs: string[]): Promise<DrainingDeploymentOutput[]> {
    if (!dseqs.length) {
      return [];
    }

    try {
      return await this.rpcService.findManyByDseqAndOwner(closureHeight, owner, dseqs);
    } catch (error) {
      this.loggerService.error({
        event: "LEASE_RPC_QUERY_FAILED_FALLBACK_TO_DB",
        message: `RPC query failed for owner ${owner}, falling back to database`,
        owner,
        error
      });
      return await this.leaseRepository.findManyByDseqAndOwner(closureHeight, owner, dseqs);
    }
  }

  /** The indexer fallback counts reclaiming leases the chain source leaves out, which can only overstate the week ahead. */
  async #findActiveLeaseRates(owner: string, dseqs: string[]): Promise<ActiveLeaseRate[]> {
    try {
      return await this.rpcService.findActiveLeaseRates(owner, dseqs);
    } catch (error) {
      this.loggerService.error({
        event: "ACTIVE_LEASE_RATE_RPC_QUERY_FAILED_FALLBACK_TO_DB",
        message: `RPC query failed for owner ${owner}, falling back to database`,
        owner,
        error
      });
      return await this.leaseRepository.findActiveLeaseRates(owner, dseqs);
    }
  }
}
