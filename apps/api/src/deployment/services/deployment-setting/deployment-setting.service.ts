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

type DeploymentSettingWithEstimatedTopUpAmount = DeploymentSettingsOutput & { estimatedTopUpAmount: number; topUpFrequencyMs: number };

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
    private readonly userWalletRepository: UserWalletRepository
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
      await this.walletReloadJobService.scheduleImmediate(result.userId);
    }

    return result;
  }

  async upsert(
    params: FindDeploymentSettingParams,
    input: Pick<DeploymentSettingsInput, "autoTopUpEnabled">
  ): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    let setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "update").updateBy(params, input, { returning: true });

    try {
      setting =
        setting ||
        (await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create({
          ...input,
          ...params
        }));

      return this.withEstimatedTopUpAmount(setting);
    } catch (error) {
      assert(!(error instanceof ForbiddenError), 404, "Deployment setting not found");
      throw error;
    }
  }

  async withEstimatedTopUpAmount(params: DeploymentSettingsOutput): Promise<DeploymentSettingWithEstimatedTopUpAmount>;
  async withEstimatedTopUpAmount(params: undefined): Promise<undefined>;
  async withEstimatedTopUpAmount(params?: DeploymentSettingsOutput): Promise<DeploymentSettingWithEstimatedTopUpAmount | undefined> {
    if (!params) {
      return undefined;
    }

    if (!params.autoTopUpEnabled) {
      return { ...params, estimatedTopUpAmount: 0, topUpFrequencyMs: this.topUpFrequencyMs };
    }

    const estimatedTopUpAmount = await this.drainingDeploymentService.calculateTopUpAmountForDseqAndUserId(params.dseq, params.userId);
    if (estimatedTopUpAmount < 0) {
      this.logger.warn({
        event: "ESTIMATED_TOP_UP_AMOUNT_NEGATIVE",
        estimatedTopUpAmount,
        dseq: params.dseq,
        userId: params.userId
      });
    }

    return { ...params, estimatedTopUpAmount, topUpFrequencyMs: this.topUpFrequencyMs };
  }
}
