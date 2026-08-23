import { createOtelLogger } from "@akashnetwork/logging/otel";
import { ForbiddenError } from "@casl/ability";
import { millisecondsInHour } from "date-fns/constants";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { FundDeploymentCommand } from "@src/billing/commands/fund-deployment.command";
import { UserWalletRepository } from "@src/billing/repositories";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FindDeploymentSettingParams } from "@src/deployment/http-schemas/deployment-setting.schema";
import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/deployment/http-schemas/runtime-limit";
import {
  DeploymentSettingRepository,
  DeploymentSettingsInput,
  DeploymentSettingsOutput
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DrainingDeploymentService } from "../draining-deployment/draining-deployment.service";
import { TopUpManagedDeploymentsInstrumentationService } from "../top-up-managed-deployments/top-up-managed-deployments-instrumentation.service";

type DeploymentSettingWithEstimatedTopUpAmount = Omit<DeploymentSettingsOutput, "lastFundedAt" | "runtimeEndsAt"> & {
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
    private readonly config: DeploymentConfigService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly instrumentation: TopUpManagedDeploymentsInstrumentationService,
    private readonly domainEvents: DomainEventsService
  ) {}

  async findOrCreateByUserIdAndDseq(params: FindDeploymentSettingParams): Promise<DeploymentSettingWithEstimatedTopUpAmount | undefined> {
    const setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(params);

    if (setting) {
      return this.withEstimatedTopUpAmount(setting);
    }

    try {
      const userWallet = await this.userWalletRepository.findOneByUserId(params.userId);
      return await this.create({ ...params, autoTopUpEnabled: !!userWallet });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return undefined;
      }
      throw error;
    }
  }

  async create(input: DeploymentSettingsInput): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    const result = await this.withEstimatedTopUpAmount(await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create(input));

    if (result.autoTopUpEnabled) {
      await this.walletReloadJobService.scheduleImmediate({ userId: result.userId });
    }

    return result;
  }

  async upsert(
    params: FindDeploymentSettingParams,
    input: Pick<DeploymentSettingsInput, "autoTopUpEnabled" | "runtimeLimitHours">
  ): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    try {
      const existing = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(params);
      const setting =
        input.runtimeLimitHours != null
          ? await this.#setRuntimeLimit(params, { ...input, runtimeLimitHours: input.runtimeLimitHours }, existing)
          : await this.#setAutoTopUp(params, input);

      if (input.autoTopUpEnabled !== undefined && existing?.autoTopUpEnabled !== input.autoTopUpEnabled) {
        this.instrumentation.recordSettingToggle(input.autoTopUpEnabled);
      }

      return this.withEstimatedTopUpAmount(setting);
    } catch (error) {
      assert(!(error instanceof ForbiddenError), 404, "Deployment setting not found");
      throw error;
    }
  }

  async #setAutoTopUp(params: FindDeploymentSettingParams, input: Pick<DeploymentSettingsInput, "autoTopUpEnabled">): Promise<DeploymentSettingsOutput> {
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
   * limit on a running deployment would silently bring the close forward, and removing one would
   * break the promise the user bought. Extensions are therefore additive, and the request carries the
   * new total so a retry cannot extend twice.
   *
   * A limited deployment always has auto top-up on, because funding is what keeps it alive up to the
   * limit; a limited row with funding off would be closed by the chain long before its deadline.
   */
  async #setRuntimeLimit(
    params: FindDeploymentSettingParams,
    input: Pick<DeploymentSettingsInput, "autoTopUpEnabled"> & { runtimeLimitHours: number },
    existing: DeploymentSettingsOutput | undefined
  ): Promise<DeploymentSettingsOutput> {
    const { runtimeLimitHours } = input;
    const setting = existing ? await this.#raiseRuntimeLimit(params, existing, runtimeLimitHours) : await this.#createRuntimeLimitedSetting(params, input);

    this.logger.info({
      event: "RUNTIME_LIMIT_CHANGED",
      dseq: params.dseq,
      from: existing?.runtimeLimitHours ?? null,
      to: runtimeLimitHours,
      anchored: setting.runtimeEndsAt !== null
    });

    if (setting.runtimeEndsAt) {
      await this.#fundUpToNewDeadline(params.userId, params.dseq);
    }

    return setting;
  }

  #createRuntimeLimitedSetting(
    params: FindDeploymentSettingParams,
    input: Pick<DeploymentSettingsInput, "autoTopUpEnabled"> & { runtimeLimitHours: number }
  ): Promise<DeploymentSettingsOutput> {
    this.#assertWithinFirstIncrement(input.runtimeLimitHours);

    return this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create({
      ...params,
      runtimeLimitHours: input.runtimeLimitHours,
      autoTopUpEnabled: input.autoTopUpEnabled ?? true
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
   * An extension moves the deadline that auto-funding clamps its deposits to, so the hours the user
   * just bought need a deposit now rather than whenever the hourly sweep next runs. This is the same
   * command lease start publishes, under the same singleton key, so a funding pass already in flight
   * for this deployment absorbs the request instead of depositing twice.
   *
   * Only an anchored deadline needs this. An unanchored limit has no lease yet, and the command
   * published at lease start funds it.
   */
  async #fundUpToNewDeadline(userId: string, dseq: string): Promise<void> {
    const wallet = await this.userWalletRepository.findOneByUserId(userId);

    if (!wallet?.address) {
      this.logger.warn({ event: "RUNTIME_LIMIT_FUNDING_SKIPPED", reason: "WALLET_NOT_FOUND", dseq, userId });
      return;
    }

    await this.domainEvents.publish(new FundDeploymentCommand({ walletId: wallet.id, address: wallet.address, dseq }), {
      singletonKey: `${FundDeploymentCommand.name}.${dseq}.${wallet.id}`
    });
  }

  /** `lastFundedAt` is the auto-funding claim marker and stays out of the API payload. */
  async withEstimatedTopUpAmount(params: DeploymentSettingsOutput): Promise<DeploymentSettingWithEstimatedTopUpAmount>;
  async withEstimatedTopUpAmount(params: undefined): Promise<undefined>;
  async withEstimatedTopUpAmount(params?: DeploymentSettingsOutput): Promise<DeploymentSettingWithEstimatedTopUpAmount | undefined> {
    if (!params) {
      return undefined;
    }

    const { lastFundedAt, runtimeEndsAt, ...rest } = params;
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
