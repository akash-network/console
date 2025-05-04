import assert from "http-assert";
import { singleton } from "tsyringe";
import { z } from "zod";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import {
  CloseDeploymentResponse,
  CreateDeploymentRequest,
  CreateDeploymentResponse,
  DepositDeploymentRequest,
  DepositDeploymentResponse,
  GetDeploymentResponse,
  ListByOwnerResponseSchema,
  ListDeploymentsResponseSchema,
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
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async findByDseq(dseq: string): Promise<GetDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const deployment = await this.deploymentReaderService.findByOwnerAndDseq(userWallet.address, dseq);

    return {
      data: deployment
    };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async create(input: CreateDeploymentRequest["data"]): Promise<CreateDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const result = await this.deploymentWriterService.create(userWallet, input);

    return {
      data: result
    };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async close(dseq: string): Promise<CloseDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const result = await this.deploymentWriterService.close(userWallet, dseq);

    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async deposit(input: DepositDeploymentRequest["data"]): Promise<DepositDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const result = await this.deploymentWriterService.deposit(userWallet, input.dseq, input.deposit);

    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async update(dseq: string, input: UpdateDeploymentRequest["data"]): Promise<UpdateDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const result = await this.deploymentWriterService.update(userWallet, dseq, input);

    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async list({ skip, limit }: { skip?: number; limit?: number }): Promise<z.infer<typeof ListDeploymentsResponseSchema>> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const { deployments, total, hasMore } = await this.deploymentReaderService.list(userWallet.address, { skip, limit });

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

  async listByOwner(
    address: string,
    skip: number,
    limit: number,
    reverseSorting: boolean,
    filters: { status?: "active" | "closed" } = {}
  ): Promise<z.infer<typeof ListByOwnerResponseSchema>> {
    return this.deploymentReaderService.listByOwner(address, skip, limit, reverseSorting, filters);
  }
}
