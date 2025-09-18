import { injectable } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { LoggerService } from "@src/core/providers/logging.provider";
import type { Resolver } from "@src/core/providers/resolvers.provider";
import { DATA_RESOLVER } from "@src/core/providers/resolvers.provider";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { UserOutput } from "@src/user/repositories";

@injectable({ token: DATA_RESOLVER })
export class ActiveDeploymentsCountService implements Resolver {
  readonly key = "activeDeployments";

  constructor(
    private readonly deploymentRepository: DeploymentRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly loggerService: LoggerService
  ) {
    loggerService.setContext(ActiveDeploymentsCountService.name);
  }

  async resolve(user: UserOutput) {
    const userWallet = await this.userWalletRepository.findOneByUserId(user.id);

    if (userWallet?.address) {
      return this.deploymentRepository.countActiveByOwner(userWallet.address);
    } else {
      this.loggerService.warn({
        userId: user.id,
        event: "NO_WALLET_ADDRESS"
      });
      throw new Error("User wallet not found");
    }
  }
}
