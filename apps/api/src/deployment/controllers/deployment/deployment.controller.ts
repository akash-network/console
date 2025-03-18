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

    const wallets = await this.userWalletRepository.accessibleBy(ability, "sign").findByUserId(userId ?? currentUser.id);
    const deployment = await this.deploymentService.findByOwnerAndDseq(wallets[0].address, dseq);

    return {
      data: deployment
    };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async create(input: CreateDeploymentRequest["data"]): Promise<CreateDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const wallets = await this.userWalletRepository.accessibleBy(ability, "sign").findByUserId(currentUser.id);
    const result = await this.deploymentService.create(wallets[0], input);

    return {
      data: result
    };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async close(dseq: string): Promise<CloseDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const wallets = await this.userWalletRepository.accessibleBy(ability, "sign").findByUserId(currentUser.id);
    const result = await this.deploymentService.close(wallets[0], dseq);

    return { data: result };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async deposit(dseq: string, input: DepositDeploymentRequest["data"]): Promise<DepositDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const wallets = await this.userWalletRepository.accessibleBy(ability, "sign").findByUserId(currentUser.id);
    const result = await this.deploymentService.deposit(wallets[0], dseq, input.deposit);

    return { data: result };
  }
}
