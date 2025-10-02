import assert from "http-assert";
import { singleton } from "tsyringe";
import { z } from "zod";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import {
  CloseDeploymentResponse,
  CreateDeploymentRequest,
  CreateDeploymentResponse,
  DepositDeploymentRequest,
  DepositDeploymentResponse,
  GetDeploymentByOwnerDseqResponse,
  GetDeploymentResponse,
  ListDeploymentsResponseSchema,
  ListWithResourcesParams,
  ListWithResourcesQuery,
  ListWithResourcesResponse,
  UpdateDeploymentRequest,
  UpdateDeploymentResponse
} from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";

@singleton()
export class DeploymentController {
  constructor(
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async findByDseq(dseq: string): Promise<GetDeploymentResponse> {
    const deployment = await this.deploymentReaderService.findByUserIdAndDseq(this.authService.currentUser.id, dseq);
    return { data: deployment };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async create(input: CreateDeploymentRequest["data"]): Promise<CreateDeploymentResponse> {
    const result = await this.deploymentWriterService.create({ ...input, userId: this.authService.currentUser.id });
    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async close(dseq: string): Promise<CloseDeploymentResponse> {
    await this.deploymentWriterService.closeByUserIdAndDseq(this.authService.currentUser.id, dseq);
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
  async list({ skip, limit }: { skip?: number; limit?: number }): Promise<z.infer<typeof ListDeploymentsResponseSchema>> {
    const { deployments, total, hasMore } = await this.deploymentReaderService.list({
      query: {
        userId: this.authService.currentUser.id
      },
      skip,
      limit
    });

    return {
      data: {
        deployments,
        pagination: {
          total,
          skip: skip ?? 0,
          limit: limit ?? total,
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
}
