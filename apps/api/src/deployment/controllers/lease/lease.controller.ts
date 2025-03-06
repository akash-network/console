import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CreateLeaseRequest } from "@src/deployment/http-schemas/lease.schema";
import { LeaseService } from "@src/deployment/services/lease/lease.service";

@singleton()
export class LeaseController {
  constructor(
    private readonly leaseService: LeaseService,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async createLeasesAndSendManifest(input: CreateLeaseRequest): Promise<GetDeploymentResponse> {
    const { currentUser, ability } = this.authService;

    const wallets = await this.userWalletRepository.accessibleBy(ability, "sign").findByUserId(currentUser.userId);
    const result = await this.leaseService.createLeasesAndSendManifest(wallets[0], input);

    return { data: result };
  }
}
