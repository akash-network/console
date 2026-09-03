import { createOtelLogger } from "@akashnetwork/logging/otel";
import { ForbiddenError } from "@casl/ability";
import { millisecondsInHour } from "date-fns/constants";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { FundDeploymentCommand } from "@src/billing/commands/fund-deployment.command";
import { UserWalletRepository } from "@src/billing/repositories";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FindDeploymentSettingParams } from "@src/deployment/http-schemas/deployment-setting.schema";
import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/deployment/http-schemas/runtime-limit";
import {
  DeploymentSettingRepository,
  DeploymentSettingsInput,
  DeploymentSettingsOutput
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentCloseJobService } from "../deployment-close-job/deployment-close-job.service";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DrainingDeploymentService } from "../draining-deployment/draining-deployment.service";

/** The fields a PATCH may change. A null `runtimeLimitHours` removes the limit; an absent one leaves it alone. */
type DeploymentSettingChange = Pick<DeploymentSettingsInput, "runtimeLimitHours">;

type DeploymentSettingWithEstimatedTopUpAmount = Omit<
  DeploymentSettingsOutput,
  "lastFundedAt" | "runtimeEndingNotifiedFor" | "providerUnreachableNotifiedFor" | "sdl" | "sealedSecrets" | "manifestVersion" | "runtimeEndsAt"
> & {
  estimatedTopUpAmount: number;
  topUpFrequencyMs: number;
  runtimeEndsAt: string | null;
};

@singleton()
export class DeploymentSettingService {
  private readonly logger = createOtelLogger({ context: DeploymentSettingService.name });

  private readonly topUpFrequencyMs = this.config.get("AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H") * millisecondsInHour;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly authService: AuthService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly deploymentCloseJobService: DeploymentCloseJobService,
    private readonly config: DeploymentConfigService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly domainEvents: DomainEventsService
  ) {}

  async findOrCreateByUserIdAndDseq(params: FindDeploymentSettingParams): Promise<DeploymentSettingWithEstimatedTopUpAmount | undefined> {
    const setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(params);

    if (setting) {
      return this.withEstimatedTopUpAmount(setting);
    }

    try {
      return await this.createWithDefaults(params);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Creates a settings row on the repository's defaults, recording no choice by the user. Deployment
   * create uses this: the row exists from the start without scheduling a wallet reload the user never
   * asked for, which is what makes creating a row cheap enough to do for every deployment.
   */
  async createWithDefaults(params: FindDeploymentSettingParams): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    return await this.withEstimatedTopUpAmount(await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create(params));
  }

  /**
   * Takes the same reconciling path as `upsert` rather than inserting blind, because by the time this
   * runs the row usually exists: creating a deployment records what it is, on the very row this
   * endpoint writes. A caller doing `POST /v1/deployments` and then `POST /v1/deployment-settings` for
   * the same dseq would otherwise hit the (dseq, userId) unique and get a 500 for a request that used
   * to succeed.
   */
  async create(input: FindDeploymentSettingParams & DeploymentSettingChange): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    const { userId, dseq, ...change } = input;
    const setting = await this.#writeReconcilingConcurrentCreate({ userId, dseq }, change);
    const result = await this.withEstimatedTopUpAmount(setting);

    if (result.autoTopUpEnabled) {
      await this.walletReloadJobService.scheduleImmediate({ userId: result.userId });
    }

    return result;
  }

  async upsert(params: FindDeploymentSettingParams, input: DeploymentSettingChange): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    try {
      return this.withEstimatedTopUpAmount(await this.#writeReconcilingConcurrentCreate(params, input));
    } catch (error) {
      assert(!(error instanceof ForbiddenError), 404, "Deployment setting not found");
      throw error;
    }
  }

  /**
   * A row can appear between the read and the write: a settings read creates one lazily, and a second
   * request for the same deployment takes the same no-row-yet branch. The (dseq, userId) unique catches
   * whichever insert loses, and re-reading lets the request run again as an update, landing where it
   * would have had it arrived a moment later instead of surfacing the driver error as a 500. One retry
   * is enough, since the row that broke the first attempt cannot be created a second time.
   */
  async #writeReconcilingConcurrentCreate(params: FindDeploymentSettingParams, input: DeploymentSettingChange): Promise<DeploymentSettingsOutput> {
    const existing = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(params);

    try {
      return await this.#writeRequestedSetting(params, input, existing);
    } catch (error) {
      if (existing || !isUniqueViolation(error)) {
        throw error;
      }

      const concurrent = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(params);
      assert(concurrent, 409, "Deployment setting changed concurrently, please retry");

      return await this.#writeRequestedSetting(params, input, concurrent);
    }
  }

  #writeRequestedSetting(
    params: FindDeploymentSettingParams,
    input: DeploymentSettingChange,
    existing: DeploymentSettingsOutput | undefined
  ): Promise<DeploymentSettingsOutput> {
    if (input.runtimeLimitHours === undefined) {
      return this.#patchOrCreate(params, input);
    }

    if (input.runtimeLimitHours === null) {
      return this.#removeRuntimeLimit(params, input, existing);
    }

    return this.#setRuntimeLimit(params, input.runtimeLimitHours, existing);
  }

  async #patchOrCreate(params: FindDeploymentSettingParams, input: DeploymentSettingsInput): Promise<DeploymentSettingsOutput> {
    const updated = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "update").updateBy(params, input, { returning: true });

    return (
      updated ||
      (await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create({
        ...input,
        ...params
      }))
    );
  }

  /**
   * Runtime limits only ever go up: a deployment is closed once its limit is reached, so lowering a
   * limit on a running deployment would silently bring the close forward. Extensions are therefore
   * additive, and the request carries the new total so a retry cannot extend twice. Dropping a limit
   * altogether is a separate request, handled by #removeRuntimeLimit.
   *
   * A limited deployment always has auto top-up on, because funding is what keeps it alive up to the
   * limit; a limited row with funding off would be closed by the chain long before its deadline. Both
   * paths below turn it on, healing any legacy row still carrying `autoTopUpEnabled: false`.
   */
  async #setRuntimeLimit(
    params: FindDeploymentSettingParams,
    runtimeLimitHours: number,
    existing: DeploymentSettingsOutput | undefined
  ): Promise<DeploymentSettingsOutput> {
    const setting = existing
      ? await this.#raiseRuntimeLimit(params, existing, runtimeLimitHours)
      : await this.#createRuntimeLimitedSetting(params, { runtimeLimitHours });

    this.logger.info({
      event: "RUNTIME_LIMIT_CHANGED",
      dseq: params.dseq,
      from: existing?.runtimeLimitHours ?? null,
      to: runtimeLimitHours,
      anchored: setting.runtimeEndsAt !== null
    });

    if (setting.runtimeEndsAt) {
      await this.#requestImmediateFunding(params.userId, params.dseq);
      await this.#rescheduleCloseJob(setting);
    }

    return setting;
  }

  #createRuntimeLimitedSetting(params: FindDeploymentSettingParams, input: { runtimeLimitHours: number }): Promise<DeploymentSettingsOutput> {
    this.#assertWithinFirstIncrement(input.runtimeLimitHours);

    return this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create({
      ...params,
      runtimeLimitHours: input.runtimeLimitHours,
      autoTopUpEnabled: true
    });
  }

  async #raiseRuntimeLimit(
    params: FindDeploymentSettingParams,
    existing: DeploymentSettingsOutput,
    runtimeLimitHours: number
  ): Promise<DeploymentSettingsOutput> {
    assert(!existing.closed, 400, "Deployment is closed");

    if (existing.runtimeLimitHours === null) {
      this.#assertWithinFirstIncrement(runtimeLimitHours);
    } else {
      assert(runtimeLimitHours > existing.runtimeLimitHours, 400, "Runtime limit can only be increased");
      assert(
        runtimeLimitHours - existing.runtimeLimitHours <= MAX_RUNTIME_LIMIT_INCREMENT_HOURS,
        400,
        `Runtime limit cannot be extended by more than ${MAX_RUNTIME_LIMIT_INCREMENT_HOURS} hours at a time`
      );
    }

    const updated = await this.deploymentSettingRepository
      .accessibleBy(this.authService.ability, "update")
      .applyRuntimeLimit({ ...params, runtimeLimitHours, maxIncrementHours: MAX_RUNTIME_LIMIT_INCREMENT_HOURS });

    assert(updated, 409, "Runtime limit changed concurrently, please retry");

    return updated;
  }

  #assertWithinFirstIncrement(runtimeLimitHours: number): void {
    assert(runtimeLimitHours <= MAX_RUNTIME_LIMIT_INCREMENT_HOURS, 400, `Runtime limit cannot exceed ${MAX_RUNTIME_LIMIT_INCREMENT_HOURS} hours`);
  }

  /**
   * Puts a limited deployment back on always-on funding. Safe in a way that lowering a limit is not:
   * it can only ever postpone a close, never bring one forward. The deadline is cleared along with the
   * limit, or the closer would still act on it.
   *
   * Nothing recorded here says a deployment was once limited, so the one-way rule lives in the UI,
   * which offers no way back. A limit set again through the API is harmless: it re-anchors on the next
   * draining sweep.
   */
  async #removeRuntimeLimit(
    params: FindDeploymentSettingParams,
    input: DeploymentSettingChange,
    existing: DeploymentSettingsOutput | undefined
  ): Promise<DeploymentSettingsOutput> {
    assert(!existing?.closed, 400, "Deployment is closed");

    const setting = await this.#patchOrCreate(params, { ...input, runtimeLimitHours: null, runtimeEndsAt: null });

    this.logger.info({
      event: "RUNTIME_LIMIT_CHANGED",
      dseq: params.dseq,
      from: existing?.runtimeLimitHours ?? null,
      to: null,
      anchored: false
    });

    if (existing?.runtimeEndsAt) {
      await this.#requestImmediateFunding(params.userId, params.dseq);
      await this.#cancelCloseJob(existing);
    }

    return setting;
  }

  /**
   * Auto-funding never deposits past a deployment's runtime deadline, so both raising a limit and
   * removing one leave the deployment short of the runtime the user just asked for until the next
   * hourly sweep. Publishing here closes that gap. It is the same command lease start publishes, under
   * the same singleton key, so a funding pass already in flight for this deployment absorbs the
   * request instead of depositing twice.
   *
   * Only an anchored deployment needs this. Without a lease there is nothing to fund yet, and the
   * command published at lease start covers it.
   *
   * Never throws: the limit change is already committed by the time this runs, so a failure here must
   * not turn a successful request into a 500 that invites a retry the increase-only rule would reject.
   * The hourly sweep is the fallback.
   */
  async #requestImmediateFunding(userId: string, dseq: string): Promise<void> {
    try {
      const wallet = await this.userWalletRepository.findOneByUserId(userId);

      if (!wallet?.address) {
        this.logger.warn({ event: "RUNTIME_LIMIT_FUNDING_SKIPPED", reason: "WALLET_NOT_FOUND", dseq, userId });
        return;
      }

      await this.domainEvents.publish(new FundDeploymentCommand({ walletId: wallet.id, address: wallet.address, dseq }), {
        singletonKey: `${FundDeploymentCommand.name}.${dseq}.${wallet.id}`
      });
    } catch (error) {
      this.logger.error({ event: "RUNTIME_LIMIT_FUNDING_FAILED", dseq, userId, error });
    }
  }

  /**
   * Moves the deployment's close job to the deadline the extension just wrote.
   *
   * Never throws, for the same reason `#requestImmediateFunding` does not: the limit change is already
   * committed, so a failure here must not turn a successful request into a 500 that invites a retry the
   * increase-only rule would reject. It is also self-healing, because a job left on the old deadline
   * fires, reads the deadline that has since moved, and reschedules itself.
   */
  async #rescheduleCloseJob(setting: DeploymentSettingsOutput): Promise<void> {
    try {
      await this.deploymentCloseJobService.schedule(
        { deploymentSettingId: setting.id, userId: setting.userId, dseq: setting.dseq },
        { startAfter: setting.runtimeEndsAt!, withCleanup: true }
      );
    } catch (error) {
      this.logger.error({ event: "RUNTIME_LIMIT_CLOSE_JOB_SYNC_FAILED", dseq: setting.dseq, userId: setting.userId, error });
    }
  }

  /**
   * Drops the close job along with the limit it was scheduled for. Never throws, and self-healing in
   * the same way: a job that outlives its cancellation fires, finds no deadline on the row, and closes
   * nothing.
   */
  async #cancelCloseJob(setting: DeploymentSettingsOutput): Promise<void> {
    try {
      await this.deploymentCloseJobService.cancel(setting.id);
    } catch (error) {
      this.logger.error({ event: "RUNTIME_LIMIT_CLOSE_JOB_SYNC_FAILED", dseq: setting.dseq, userId: setting.userId, error });
    }
  }

  /**
   * `lastFundedAt`, `runtimeEndingNotifiedFor` and `providerUnreachableNotifiedFor` are internal sweep markers and stay
   * out of the API payload. So do `sdl`, `sealedSecrets` and `manifestVersion`: they are what the console remembers a
   * deployment by, not something it hands back, and the response schema is types only — whatever this returns is
   * what ships. `sealedSecrets` is ciphertext rather than a value, but it is the one field here no response has any
   * reason to carry, so it is dropped by the same rule rather than by a weaker one.
   */
  async withEstimatedTopUpAmount(params: DeploymentSettingsOutput): Promise<DeploymentSettingWithEstimatedTopUpAmount>;
  async withEstimatedTopUpAmount(params: undefined): Promise<undefined>;
  async withEstimatedTopUpAmount(params?: DeploymentSettingsOutput): Promise<DeploymentSettingWithEstimatedTopUpAmount | undefined> {
    if (!params) {
      return undefined;
    }

    const { lastFundedAt, runtimeEndingNotifiedFor, providerUnreachableNotifiedFor, sdl, sealedSecrets, manifestVersion, runtimeEndsAt, ...rest } = params;
    const setting = { ...rest, runtimeEndsAt: runtimeEndsAt?.toISOString() ?? null };

    if (!setting.autoTopUpEnabled) {
      return { ...setting, estimatedTopUpAmount: 0, topUpFrequencyMs: this.topUpFrequencyMs };
    }

    const estimatedTopUpAmount = await this.drainingDeploymentService.calculateTopUpAmountForDseqAndUserId(setting.dseq, setting.userId);
    if (estimatedTopUpAmount < 0) {
      this.logger.warn({
        event: "ESTIMATED_TOP_UP_AMOUNT_NEGATIVE",
        estimatedTopUpAmount,
        dseq: setting.dseq,
        userId: setting.userId
      });
    }

    return { ...setting, estimatedTopUpAmount, topUpFrequencyMs: this.topUpFrequencyMs };
  }
}
