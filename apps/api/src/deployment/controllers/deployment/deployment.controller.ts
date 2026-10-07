/* v8 ignore start */
import assert from "http-assert";
import { singleton } from "tsyringe";
import { z } from "zod";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { CloseDeploymentAcceptedResponse, CloseDeploymentQuery, ListDeploymentsQuery } from "@src/deployment/http-schemas/deployment.schema";
import {
  CloseDeploymentResponse,
  CreateDeploymentDefinitionRequest,
  CreateDeploymentDefinitionResponse,
  CreateDeploymentRequest,
  CreateDeploymentResponse,
  DepositDeploymentRequest,
  DepositDeploymentResponse,
  GetDeploymentByOwnerDseqResponse,
  GetDeploymentNamesResponse,
  GetDeploymentResponse,
  GetWeeklyDeploymentCostResponse,
  ListDeploymentsResponseSchema,
  ListWithResourcesParams,
  ListWithResourcesQuery,
  ListWithResourcesResponse,
  PatchDeploymentRequest,
  PatchDeploymentResponse,
  UpdateDeploymentRequest,
  UpdateDeploymentResponse
} from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";

@singleton()
export class DeploymentController {
  constructor(
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly authService: AuthService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly featureFlagsService: FeatureFlagsService
  ) {}

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async findByDseq(dseq: string): Promise<GetDeploymentResponse> {
    const deployment = await this.deploymentReaderService.findByUserIdAndDseq(this.authService.currentUser.id, dseq);
    return { data: deployment };
  }

  @Protected([{ action: "read", subject: "UserWallet" }])
  async findNames(dseqs: string[]): Promise<GetDeploymentNamesResponse> {
    const names = await this.deploymentReaderService.findNames(this.authService.currentUser.id, dseqs);
    return { data: names };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async create(input: CreateDeploymentRequest["data"]): Promise<CreateDeploymentResponse> {
    const result = await this.deploymentWriterService.create({ ...input, userId: this.authService.currentUser.id });
    return { data: result };
  }

  /** The flag is read here rather than in the worker, because inside a job every user evaluates as the background-job user. */
  @Protected([{ action: "sign", subject: "UserWallet" }])
  async close(dseq: string, query: CloseDeploymentQuery = { async: false }): Promise<CloseDeploymentResponse | CloseDeploymentAcceptedResponse> {
    const userId = this.authService.currentUser.id;

    if (query.async && this.featureFlagsService.isEnabled(FeatureFlags.BACKGROUND_DEPLOYMENT_CLOSE, { userId })) {
      const queued = await this.deploymentWriterService.closeInBackgroundByUserIdAndDseq(userId, dseq, { batchId: query.batchId });
      return queued ? { data: queued } : { data: { success: true } };
    }

    await this.deploymentWriterService.closeByUserIdAndDseq(userId, dseq, { batchId: query.batchId });
    return { data: { success: true } };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async deposit(input: DepositDeploymentRequest["data"]): Promise<DepositDeploymentResponse> {
    const result = await this.deploymentWriterService.deposit({
      dseq: input.dseq,
      amount: input.deposit,
      userId: this.authService.currentUser.id
    });
    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async update(dseq: string, input: UpdateDeploymentRequest["data"]): Promise<UpdateDeploymentResponse> {
    const result = await this.deploymentWriterService.updateByUserIdAndDseq(this.authService.currentUser.id, dseq, input);
    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async patch(dseq: string, input: PatchDeploymentRequest["data"]): Promise<PatchDeploymentResponse> {
    const result = await this.deploymentWriterService.patchByUserIdAndDseq(this.authService.currentUser.id, dseq, input, this.authService.ability);
    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async createDefinition(dseq: string, input: CreateDeploymentDefinitionRequest["data"]): Promise<CreateDeploymentDefinitionResponse> {
    const result = await this.deploymentWriterService.recordDefinitionByUserIdAndDseq(this.authService.currentUser.id, dseq, input, this.authService.ability);
    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async list({ state, reverse, search, skip, limit }: ListDeploymentsQuery): Promise<z.infer<typeof ListDeploymentsResponseSchema>> {
    const { deployments, total, hasMore } = await this.deploymentReaderService.list({
      query: {
        userId: this.authService.currentUser.id
      },
      state,
      reverse,
      search,
      skip,
      limit
    });

    return {
      data: {
        deployments,
        pagination: {
          total,
          skip,
          limit,
          hasMore
        }
      }
    };
  }

  async listWithResources({ address, ...query }: ListWithResourcesParams & ListWithResourcesQuery): Promise<ListWithResourcesResponse> {
    return this.deploymentReaderService.listWithResources({ address, ...query });
  }

  async getByOwnerAndDseq(owner: string, dseq: string): Promise<GetDeploymentByOwnerDseqResponse> {
    const deployment = await this.deploymentReaderService.getDeploymentByOwnerAndDseq(owner, dseq);

    assert(deployment, 404, "Deployment Not Found");

    return deployment;
  }

  @Protected([{ action: "read", subject: "UserWallet" }])
  async getWeeklyDeploymentCost(): Promise<GetWeeklyDeploymentCostResponse> {
    const weeklyCost = await this.drainingDeploymentService.calculateWeeklyDeploymentCost(this.authService.currentUser.id, this.authService.ability);
    return { data: { weeklyCost } };
  }
}
