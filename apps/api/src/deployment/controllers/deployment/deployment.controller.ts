import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { CreateDeploymentRequest, CreateDeploymentResponse, GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
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

    const wallets = await this.userWalletRepository.accessibleBy(ability, "sign").findByUserId(userId ?? currentUser.userId);
    const deployment = await this.deploymentService.findByOwnerAndDseq(wallets[0].address, dseq);

    return {
      data: deployment
    }
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async create(input: CreateDeploymentRequest['data']): Promise<CreateDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const wallets = await this.userWalletRepository.accessibleBy(ability, "sign").findByUserId(currentUser.userId);
    const result = await this.deploymentService.create(wallets[0], input);

    return {
      data: result
    };
  }
}
