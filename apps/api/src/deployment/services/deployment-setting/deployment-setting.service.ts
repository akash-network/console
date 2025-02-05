import { ForbiddenError } from "@casl/ability";
import { millisecondsInHour } from "date-fns/constants";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
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
  private readonly topUpFrequencyMs = this.config.get("AUTO_TOP_UP_JOB_INTERVAL_IN_H") * millisecondsInHour;
  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly authService: AuthService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly config: DeploymentConfigService
  ) {}

  async findByUserIdAndDseq(params: FindDeploymentSettingParams): Promise<DeploymentSettingWithEstimatedTopUpAmount | undefined> {
    return this.withEstimatedTopUpAmount(await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(params));
  }

  async create(input: DeploymentSettingsInput): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    return this.withEstimatedTopUpAmount(await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create(input));
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

    return { ...params, estimatedTopUpAmount, topUpFrequencyMs: this.topUpFrequencyMs };
  }
}
