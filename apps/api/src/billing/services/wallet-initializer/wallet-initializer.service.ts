import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TrialStarted } from "@src/billing/events/trial-started";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletOutput, UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { LoggerService } from "@src/core/providers/logging.provider";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";

/**
 * Onboarding deployment allowance in cents-with-4-decimal-precision ($5 = 50000).
 */
const ONBOARDING_DEPLOYMENT_ALLOWANCE_AMOUNT = 50000;

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService,
    private readonly domainEvents: DomainEventsService,
    private readonly featureFlagsService: FeatureFlagsService,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    private readonly logger: LoggerService
  ) {}

  async initializeAndGrantTrialLimits(userId: string): Promise<UserWalletPublicOutput> {
    const { wallet, isNew } = await this.userWalletRepository.accessibleBy(this.authService.ability, "create").getOrCreate({ userId });
    let userWallet = wallet;
    if (!isNew) return this.userWalletRepository.toPublic(userWallet);

    let isTrialSpendingAuthorized = false;
    try {
      const wallet = await this.walletManager.createAndAuthorizeTrialSpending(this.managedSignerService, { addressIndex: userWallet.id });
      userWallet = await this.userWalletRepository.updateById(
        userWallet.id,
        {
          address: wallet.address,
          deploymentAllowance: wallet.limits.deployment,
          feeAllowance: wallet.limits.fees,
          status: "ready"
        },
        { returning: true }
      );
      isTrialSpendingAuthorized = true;
    } catch (error) {
      await this.userWalletRepository.deleteById(userWallet.id);
      throw error;
    }

    const walletOutput = this.userWalletRepository.toPublic(userWallet);

    if (isTrialSpendingAuthorized) {
      await this.domainEvents.publish(new TrialStarted({ userId }));
    }

    return walletOutput;
  }

  async initializeForOnboarding(userId: UserWalletOutput["userId"]): Promise<UserWalletOutput> {
    const wallet = await this.userWalletRepository.create({ userId, status: "pending" });
    const deploymentAllowance = ONBOARDING_DEPLOYMENT_ALLOWANCE_AMOUNT;
    const feeAllowance = this.billingConfig.FEE_ALLOWANCE_REFILL_AMOUNT;

    try {
      const grantResult = await this.walletManager.createAndAuthorizeOnboardingGrant(this.managedSignerService, {
        addressIndex: wallet.id,
        deploymentAllowance,
        feeAllowance
      });
      const updated = await this.userWalletRepository.updateById(
        wallet.id,
        {
          address: grantResult.address,
          deploymentAllowance,
          feeAllowance,
          status: "ready"
        },
        { returning: true }
      );
      this.logger.info({ event: "ONBOARDING_WALLET_READY", userId, walletId: wallet.id });
      return updated;
    } catch (error) {
      await this.userWalletRepository.updateStatus(wallet.id, "failed");
      this.logger.error({ event: "ONBOARDING_WALLET_FAILED", userId, walletId: wallet.id, error });
      throw error;
    }
  }

  async initialize(userId: string) {
    const { id } = await this.userWalletRepository.create({ userId });
    const wallet = await this.walletManager.createWallet({ addressIndex: id });
    return await this.userWalletRepository.updateById(
      id,
      {
        address: wallet.address,
        status: "ready"
      },
      { returning: true }
    );
  }
}
