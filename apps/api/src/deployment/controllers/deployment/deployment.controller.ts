import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import {
  CloseDeploymentResponse,
  CreateDeploymentRequest,
  CreateDeploymentResponse,
  DepositDeploymentRequest,
  DepositDeploymentResponse,
  GetDeploymentResponse
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
  async findByDseqAndUserId(dseq: string, userId?: string): Promise<GetDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(userId ?? currentUser.id);
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
}
