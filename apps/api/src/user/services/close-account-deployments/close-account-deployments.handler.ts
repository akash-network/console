import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { CloseWalletDeploymentsService } from "@src/deployment/services/close-wallet-deployments/close-wallet-deployments.service";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { CloseAccountDeployments } from "./close-account-deployments.job";

@singleton()
export class CloseAccountDeploymentsHandler implements JobHandler<CloseAccountDeployments> {
  public readonly accepts = CloseAccountDeployments;

  public readonly policy = "stately";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly closeWalletDeploymentsService: CloseWalletDeploymentsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: CloseAccountDeploymentsHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** A user reinstated before the job ran keeps their deployments, because the reinstatement undid the suspension that asked for the close. */
  async handle({ userId }: JobPayload<CloseAccountDeployments>): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (user?.accountStatus !== "suspended") {
      this.logger.info({ event: "ACCOUNT_DEPLOYMENTS_CLOSE_SKIPPED", reason: "NOT_SUSPENDED", userId, accountStatus: user?.accountStatus });
      return;
    }

    const wallet = await this.userWalletRepository.findOneByUserId(userId);

    if (!wallet) {
      this.logger.info({ event: "ACCOUNT_DEPLOYMENTS_CLOSE_SKIPPED", reason: "NO_WALLET", userId });
      return;
    }

    const closedDseqs = await this.closeWalletDeploymentsService.closeAllOf(wallet);
    this.logger.info({ event: "ACCOUNT_DEPLOYMENTS_CLOSED", userId, walletId: wallet.id, closedDseqs });
  }
}
