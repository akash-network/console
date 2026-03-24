import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import {
  type CreateDeploymentSettingRequest,
  type CreateDeploymentSettingV2Request,
  type DeploymentSettingResponse,
  type FindDeploymentSettingParams,
  type FindDeploymentSettingV2Params,
  type FindDeploymentSettingV2Query,
  type UpdateDeploymentSettingRequest
} from "@src/deployment/http-schemas/deployment-setting.schema";

type FindOrCreateV2Input = FindDeploymentSettingV2Params & FindDeploymentSettingV2Query;
type UpsertV2Input = FindDeploymentSettingV2Params & FindDeploymentSettingV2Query & UpdateDeploymentSettingRequest["data"];
import { DeploymentSettingService } from "@src/deployment/services/deployment-setting/deployment-setting.service";

@singleton()
export class DeploymentSettingController {
  constructor(
    private readonly deploymentSettingService: DeploymentSettingService,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "read", subject: "DeploymentSetting" }])
  async findOrCreateByUserIdAndDseq(params: FindDeploymentSettingParams): Promise<DeploymentSettingResponse> {
    const setting = await this.deploymentSettingService.findOrCreateByUserIdAndDseq(params);
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

  @Protected([{ action: "read", subject: "DeploymentSetting" }])
  async findOrCreateV2(input: FindOrCreateV2Input): Promise<DeploymentSettingResponse> {
    const userId = input.userId ?? this.authService.currentUser.id;
    const setting = await this.deploymentSettingService.findOrCreateByUserIdAndDseq({ userId, dseq: input.dseq });
    assert(setting, 404, "Deployment setting not found");
    return { data: setting };
  }

  @Protected([{ action: "create", subject: "DeploymentSetting" }])
  async createV2(input: CreateDeploymentSettingV2Request["data"]): Promise<DeploymentSettingResponse> {
    const { userId: inputUserId, ...rest } = input;
    const userId = inputUserId ?? this.authService.currentUser.id;
    const setting = await this.deploymentSettingService.create({ ...rest, userId });
    return { data: setting };
  }

  @Protected([{ action: "update", subject: "DeploymentSetting" }])
  async upsertV2(input: UpsertV2Input): Promise<DeploymentSettingResponse> {
    const { dseq, userId: inputUserId, ...rest } = input;
    const userId = inputUserId ?? this.authService.currentUser.id;
    const setting = await this.deploymentSettingService.upsert({ userId, dseq }, rest);
    assert(setting, 404, "Deployment setting not found");
    return { data: setting };
  }
}
