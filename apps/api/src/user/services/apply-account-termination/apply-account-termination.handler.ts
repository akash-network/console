import { inject, singleton } from "tsyringe";

import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { AutoReloadShutoffService } from "@src/billing/services/auto-reload-shutoff/auto-reload-shutoff.service";
import { WalletGrantRevokerService } from "@src/billing/services/wallet-grant-revoker/wallet-grant-revoker.service";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { CloseWalletDeploymentsService } from "@src/deployment/services/close-wallet-deployments/close-wallet-deployments.service";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { ApplyAccountTermination } from "./apply-account-termination.job";

type ForfeitOutcome = { depositGrantRevoked: boolean; feeGrantRevoked: boolean };

/** Every step re-reads what it changes, so a retry after an escrow that could not settle yet resumes where the last run stopped. */
@singleton()
export class ApplyAccountTerminationHandler implements JobHandler<ApplyAccountTermination> {
  public readonly accepts = ApplyAccountTermination;

  public readonly policy = "stately";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly closeWalletDeploymentsService: CloseWalletDeploymentsService,
    private readonly autoReloadShutoffService: AutoReloadShutoffService,
    private readonly walletGrantRevokerService: WalletGrantRevokerService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ApplyAccountTerminationHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ userId, forfeitCredits }: JobPayload<ApplyAccountTermination>): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (user?.accountStatus !== "terminated") {
      this.logger.info({ event: "ACCOUNT_TERMINATION_SKIPPED", reason: "NOT_TERMINATED", userId, accountStatus: user?.accountStatus });
      return;
    }

    const wallet = await this.userWalletRepository.findOneByUserId(userId);

    if (!wallet) {
      this.logger.info({ event: "ACCOUNT_TERMINATION_SKIPPED", reason: "NO_WALLET", userId });
      return;
    }

    await this.autoReloadShutoffService.turnOff(wallet, "account-termination");
    const closedDseqs = await this.closeWalletDeploymentsService.closeAllOf(wallet);
    const forfeit = forfeitCredits ? await this.#forfeitCredits(wallet) : undefined;

    this.logger.info({ event: "ACCOUNT_TERMINATION_APPLIED", userId, walletId: wallet.id, closedDseqs, forfeitCredits, ...forfeit });
  }

  /** Runs after the closes, which return the escrow to the wallet first, and leaves the abuse lock alone since a payment would clear it. */
  async #forfeitCredits(wallet: UserWalletOutput): Promise<ForfeitOutcome> {
    const outcome: ForfeitOutcome = { depositGrantRevoked: false, feeGrantRevoked: false };

    if (wallet.address) {
      outcome.depositGrantRevoked = await this.walletGrantRevokerService.revokeDepositGrant(wallet.address);
      outcome.feeGrantRevoked = await this.walletGrantRevokerService.revokeFeeGrant(wallet.address);
    }

    await this.userWalletRepository.updateById(wallet.id, { deploymentAllowance: 0, feeAllowance: 0 });

    return outcome;
  }
}
