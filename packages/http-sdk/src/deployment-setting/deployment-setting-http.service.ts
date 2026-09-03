import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";

export interface DeploymentSettingOutput {
  id: number;
  userId: string;
  dseq: string;
  autoTopUpEnabled: boolean;
  estimatedTopUpAmount: number;
  topUpFrequencyMs: number;
  runtimeLimitHours: number | null;
  runtimeEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeploymentSettingInput {
  userId: string;
  dseq: string;
}

export interface CreateDeploymentSettingV2Input {
  dseq: string;
}

export interface UpdateDeploymentSettingInput {
  /**
   * The new total, not an increment. Runtime limits can only be raised, by at most 48 hours per request;
   * null removes the limit and puts the deployment back on always-on funding.
   */
  runtimeLimitHours?: number | null;
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

  async findByDseq(dseq: string): Promise<DeploymentSettingOutput> {
    return this.extractApiData(await this.get<DeploymentSettingOutput>(`/v2/deployment-settings/${dseq}`));
  }

  async createV2(input: CreateDeploymentSettingV2Input): Promise<DeploymentSettingOutput> {
    return this.extractApiData(await this.post<DeploymentSettingOutput>("/v2/deployment-settings", { data: input }));
  }

  async updateByDseq(dseq: string, input: UpdateDeploymentSettingInput): Promise<DeploymentSettingOutput> {
    return this.extractApiData(await this.patch<DeploymentSettingOutput>(`/v2/deployment-settings/${dseq}`, { data: input }));
  }
}
