import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";

export interface DeploymentSettingOutput {
  id: number;
  userId: string;
  dseq: string;
  autoTopUpEnabled: boolean;
  estimatedTopUpAmount: number;
  topUpFrequencyMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeploymentSettingInput {
  userId: string;
  dseq: string;
  autoTopUpEnabled: boolean;
}

export interface UpdateDeploymentSettingInput {
  autoTopUpEnabled: boolean;
}

export interface FindDeploymentSettingParams {
  userId: string;
  dseq: string;
}

export class DeploymentSettingHttpService extends ApiHttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async findByUserIdAndDseq(params: FindDeploymentSettingParams): Promise<DeploymentSettingOutput> {
    return this.extractApiData(await this.get<DeploymentSettingOutput>(`/v1/deployment-settings/${params.userId}/${params.dseq}`));
  }

  async create(input: CreateDeploymentSettingInput): Promise<DeploymentSettingOutput> {
    return this.extractApiData(await this.post<DeploymentSettingOutput>("/v1/deployment-settings", { data: input }));
  }

  async update(params: FindDeploymentSettingParams, input: UpdateDeploymentSettingInput): Promise<DeploymentSettingOutput> {
    return this.extractApiData(await this.patch<DeploymentSettingOutput>(`/v1/deployment-settings/${params.userId}/${params.dseq}`, { data: input }));
  }
}
