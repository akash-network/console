import assert from "http-assert";
import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import {
  CreateDeploymentSettingRequest,
  DeploymentSettingResponse,
  FindDeploymentSettingParams,
  UpdateDeploymentSettingRequest
} from "@src/deployment/http-schemas/deployment-setting.schema";
import { DeploymentSettingService } from "@src/deployment/services/deployment-setting/deployment-setting.service";

@singleton()
export class DeploymentSettingController {
  constructor(private readonly deploymentSettingService: DeploymentSettingService) {}

  @Protected([{ action: "read", subject: "DeploymentSetting" }])
  async findByUserIdAndDseq(params: FindDeploymentSettingParams): Promise<DeploymentSettingResponse> {
    const setting = await this.deploymentSettingService.findByUserIdAndDseq(params);
    assert(setting, 404, "Deployment setting not found");
    return { data: setting };
  }

  @Protected([{ action: "create", subject: "DeploymentSetting" }])
  async create(input: CreateDeploymentSettingRequest["data"]): Promise<DeploymentSettingResponse> {
    const setting = await this.deploymentSettingService.create(input);
    return { data: setting };
  }

  @Protected([{ action: "update", subject: "DeploymentSetting" }])
  async upsert(params: FindDeploymentSettingParams, input: UpdateDeploymentSettingRequest["data"]): Promise<DeploymentSettingResponse> {
    const setting = await this.deploymentSettingService.upsert(params, input);
    assert(setting, 404, "Deployment setting not found");
    return { data: setting };
  }
}
