import { createOtelLogger } from "@akashnetwork/logging/otel";
import { ForbiddenError } from "@casl/ability";
import { millisecondsInHour } from "date-fns/constants";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { FindDeploymentSettingParams } from "@src/deployment/http-schemas/deployment-setting.schema";
import {
  DeploymentSettingRepository,
  DeploymentSettingsInput,
  DeploymentSettingsOutput
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DrainingDeploymentService } from "../draining-deployment/draining-deployment.service";
import { TopUpManagedDeploymentsInstrumentationService } from "../top-up-managed-deployments/top-up-managed-deployments-instrumentation.service";

type DeploymentSettingWithEstimatedTopUpAmount = Omit<DeploymentSettingsOutput, "lastFundedAt" | "autoTopUpEnabled"> & {
  autoTopUpEnabled: boolean;
  estimatedTopUpAmount: number;
  topUpFrequencyMs: number;
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
    private readonly instrumentation: TopUpManagedDeploymentsInstrumentationService
  ) {}

  async findOrCreateByUserIdAndDseq(params: FindDeploymentSettingParams): Promise<DeploymentSettingWithEstimatedTopUpAmount | undefined> {
    const setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(params);

    if (setting) {
      return this.withEstimatedTopUpAmount(setting);
    }

    try {
      return await this.createUnconfigured(params);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Creates a settings row that records no auto top-up decision, so reads keep resolving it from
   * whether the owner has a managed wallet. Deployment create uses this: the row exists from the
   * start without the row's existence being mistaken for the user having chosen anything, and
   * without scheduling a wallet reload the user never asked for.
   */
  async createUnconfigured(params: FindDeploymentSettingParams): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    return await this.withEstimatedTopUpAmount(await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create(params));
  }

  async create(input: DeploymentSettingsInput): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    const result = await this.withEstimatedTopUpAmount(await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create(input));

    if (input.autoTopUpEnabled === true) {
      await this.walletReloadJobService.scheduleImmediate({ userId: result.userId });
    }

    return result;
  }

  async upsert(params: FindDeploymentSettingParams, input: { autoTopUpEnabled?: boolean }): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    try {
      const existing = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(params);
      const previousAutoTopUpEnabled = existing ? await this.resolveAutoTopUpEnabled(existing) : undefined;
      let setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "update").updateBy(params, input, { returning: true });

      setting =
        setting ||
        (await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create({
          ...input,
          ...params
        }));

      if (input.autoTopUpEnabled !== undefined && previousAutoTopUpEnabled !== input.autoTopUpEnabled) {
        this.instrumentation.recordSettingToggle(input.autoTopUpEnabled);
      }

      return this.withEstimatedTopUpAmount(setting);
    } catch (error) {
      assert(!(error instanceof ForbiddenError), 404, "Deployment setting not found");
      throw error;
    }
  }

  /** `lastFundedAt` is the auto-funding claim marker and stays out of the API payload. */
  async withEstimatedTopUpAmount(params: DeploymentSettingsOutput): Promise<DeploymentSettingWithEstimatedTopUpAmount>;
  async withEstimatedTopUpAmount(params: undefined): Promise<undefined>;
  async withEstimatedTopUpAmount(params?: DeploymentSettingsOutput): Promise<DeploymentSettingWithEstimatedTopUpAmount | undefined> {
    if (!params) {
      return undefined;
    }

    const { lastFundedAt, ...setting } = params;
    const autoTopUpEnabled = await this.resolveAutoTopUpEnabled(setting);

    if (!autoTopUpEnabled) {
      return { ...setting, autoTopUpEnabled, estimatedTopUpAmount: 0, topUpFrequencyMs: this.topUpFrequencyMs };
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

    return { ...setting, autoTopUpEnabled, estimatedTopUpAmount, topUpFrequencyMs: this.topUpFrequencyMs };
  }

  /**
   * A NULL `autoTopUpEnabled` means the user never made a choice, so it falls back to whether they
   * have a managed wallet to fund from. A stored `true` or `false` is the user's own decision and is
   * returned untouched — an explicit opt-out must never be quietly reversed by the default.
   */
  private async resolveAutoTopUpEnabled({ autoTopUpEnabled, userId }: Pick<DeploymentSettingsOutput, "autoTopUpEnabled" | "userId">): Promise<boolean> {
    if (autoTopUpEnabled !== null) {
      return autoTopUpEnabled;
    }

    return !!(await this.userWalletRepository.findOneByUserId(userId));
  }
}
