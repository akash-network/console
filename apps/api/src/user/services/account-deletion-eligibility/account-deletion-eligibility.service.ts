import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";

export interface AccountDeletionEligibility {
  activeDeploymentDseqs: string[];
  isTrialing: boolean;
  forfeitableBalanceUsd: number;
}

@singleton()
export class AccountDeletionEligibilityService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly balancesService: BalancesService
  ) {}

  async assess(userId: string): Promise<AccountDeletionEligibility> {
    return await this.assessWallet(await this.userWalletRepository.unscoped("account-deletion").findOneByUserId(userId));
  }

  async assessWallet(wallet: Pick<UserWalletOutput, "address" | "isTrialing"> | undefined): Promise<AccountDeletionEligibility> {
    const isTrialing = wallet?.isTrialing ?? true;

    if (!wallet?.address) {
      return { activeDeploymentDseqs: [], isTrialing, forfeitableBalanceUsd: 0 };
    }

    const [activeDeploymentDseqs, forfeitableBalanceUsd] = await Promise.all([
      this.findActiveDeploymentDseqs(wallet.address),
      isTrialing ? 0 : this.balancesService.getDeploymentBalanceInFiat(wallet.address)
    ]);

    return { activeDeploymentDseqs, isTrialing, forfeitableBalanceUsd };
  }

  private async findActiveDeploymentDseqs(owner: string): Promise<string[]> {
    const { deployments } = await this.deploymentHttpService.findAll({ owner, state: "active" });

    return deployments.map(({ deployment }) => deployment.id.dseq);
  }
}
