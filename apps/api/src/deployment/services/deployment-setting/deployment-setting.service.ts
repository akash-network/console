import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { FindDeploymentSettingParams } from "@src/deployment/http-schemas/deployment-setting.schema";
import {
  DeploymentSettingRepository,
  DeploymentSettingsInput,
  DeploymentSettingsOutput
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";

@singleton()
export class DeploymentSettingService {
  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly authService: AuthService
  ) {}

  async findByUserIdAndDseq(params: FindDeploymentSettingParams): Promise<DeploymentSettingsOutput> {
    return await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(params);
  }

  async create(input: DeploymentSettingsInput): Promise<DeploymentSettingsOutput> {
    return await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create(input);
  }

  async update(params: FindDeploymentSettingParams, input: Pick<DeploymentSettingsInput, "autoTopUpEnabled">): Promise<DeploymentSettingsOutput> {
    return await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "update").updateBy(params, input, { returning: true });
  }
}
