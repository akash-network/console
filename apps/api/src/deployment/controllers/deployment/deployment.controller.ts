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
  ListDeploymentsResponseSchema,
  UpdateDeploymentRequest,
  UpdateDeploymentResponse
} from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentService } from "@src/deployment/services/deployment/deployment.service";

@singleton()
export class DeploymentController {
  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async findByDseq(dseq: string): Promise<GetDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const deployment = await this.deploymentService.findByOwnerAndDseq(userWallet.address, dseq);

    return {
      data: deployment
    };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async create(input: CreateDeploymentRequest["data"]): Promise<CreateDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const result = await this.deploymentService.create(userWallet, input);

    return {
      data: result
    };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async close(dseq: string): Promise<CloseDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const result = await this.deploymentService.close(userWallet, dseq);

    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async deposit(input: DepositDeploymentRequest["data"]): Promise<DepositDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const result = await this.deploymentService.deposit(userWallet, input.dseq, input.deposit);

    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async update(dseq: string, input: UpdateDeploymentRequest["data"]): Promise<UpdateDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    const result = await this.deploymentService.update(userWallet, dseq, input);

    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async list({ skip, limit }: { skip?: number; limit?: number }): Promise<z.infer<typeof ListDeploymentsResponseSchema>> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");
    assert(
      (skip === undefined && limit === undefined) || (skip !== undefined && limit !== undefined),
      400,
      "Skip and limit must be provided together or not at all"
    );

    const { deployments, total } = await this.deploymentService.list(userWallet.address, { skip, limit });

    return {
      data: {
        deployments,
        pagination: {
          total,
          skip: skip ?? 0,
          limit: limit ?? total,
          hasMore: skip !== undefined && limit !== undefined ? total > skip + limit : false
        }
      }
    };
  }
}
