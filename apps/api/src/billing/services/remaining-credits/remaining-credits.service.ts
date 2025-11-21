import { injectable } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { LoggerService } from "@src/core/providers/logging.provider";
import type { Resolver } from "@src/core/providers/resolvers.provider";
import { DATA_RESOLVER } from "@src/core/providers/resolvers.provider";
import { UserOutput } from "@src/user/repositories";
import { udenomToDenom } from "@src/utils/math";

@injectable({ token: DATA_RESOLVER })
export class RemainingCreditsService implements Resolver {
  readonly key = "remainingCredits";

  constructor(
    private readonly balanceService: BalancesService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly loggerService: LoggerService
  ) {
    loggerService.setContext(RemainingCreditsService.name);
  }

  async resolve(user: UserOutput) {
    const userWallet = await this.userWalletRepository.findOneByUserId(user.id);
    const { address } = userWallet || {};

    if (userWallet && address) {
      const limitInUusdc = await this.balanceService.retrieveDeploymentLimit({ ...userWallet, address });
      return udenomToDenom(limitInUusdc);
    } else {
      this.loggerService.warn({
        userId: user.id,
        event: "NO_WALLET_ADDRESS"
      });
      throw new Error("User wallet not found");
    }
  }
}
