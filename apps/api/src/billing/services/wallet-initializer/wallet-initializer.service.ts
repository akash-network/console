import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TrialStarted } from "@src/billing/events/trial-started";
import { UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { StripeErrorService } from "@src/billing/services/stripe-error/stripe-error.service";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { UserOutput, UserRepository } from "@src/user/repositories";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";

export type Requires3DSResult = {
  id: null;
  userId: string;
  address: null;
  creditAmount: 0;
  isTrialing: false;
  createdAt: null;
  requires3DS: true;
  clientSecret: string | null;
  paymentIntentId: string | null;
  paymentMethodId: string | null;
};

export type StartTrialResult = UserWalletPublicOutput | Requires3DSResult;

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService,
    private readonly domainEvents: DomainEventsService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly stripeService: StripeService,
    private readonly stripeErrorService: StripeErrorService,
    private readonly userRepository: UserRepository
  ) {}

  async startTrial(userId: string): Promise<StartTrialResult> {
    const { currentUser } = this.authService;

    assert(currentUser.emailVerified, 400, "Email not verified");
    await this.#assertNoDuplicateFingerprint(currentUser);

    if (!this.featureFlagsService.isEnabled(FeatureFlags.ONBOARDING_REDESIGN_V1)) {
      assert(currentUser.stripeCustomerId, 400, "Stripe customer ID not found");
      const threeDsResult = await this.#validatePaymentMethod(currentUser);
      if (threeDsResult) return threeDsResult;
    }

    return this.initializeAndGrantTrialLimits(userId);
  }

  async #assertNoDuplicateFingerprint(user: UserOutput): Promise<void> {
    if (!this.stripeService.isProduction) return;
    if (!this.featureFlagsService.isEnabled(FeatureFlags.TRIAL_FINGERPRINT_CHECK)) return;
    if (!user.lastFingerprint) return;

    const usersWithSameFingerprint = await this.userRepository.findTrialUsersByFingerprint(user.lastFingerprint, user.id);
    assert(usersWithSameFingerprint.length === 0, 400, "Unable to start trial. Please contact support for assistance.");
  }

  async #validatePaymentMethod(user: UserOutput): Promise<Requires3DSResult | null> {
    const paymentMethods = await this.stripeService.getPaymentMethods(user.id, user.stripeCustomerId!, this.authService.ability);
    assert(paymentMethods.length > 0, 400, "You must have a payment method to start a trial.");

    if (this.stripeService.isProduction) {
      const hasDuplicateTrialAccount = await this.stripeService.hasDuplicateTrialAccount(paymentMethods, user.id);
      assert(!hasDuplicateTrialAccount, 400, "This payment method is already associated with another trial account. Please use a different payment method.");
    }

    const latestPaymentMethod = paymentMethods[0];
    try {
      const validationResult = await this.stripeService.validatePaymentMethodForTrial({
        customer: user.stripeCustomerId!,
        payment_method: latestPaymentMethod.id,
        userId: user.id
      });

      if (validationResult.requires3DS) {
        return {
          id: null,
          userId: user.id,
          address: null,
          creditAmount: 0,
          isTrialing: false,
          createdAt: null,
          requires3DS: true,
          clientSecret: validationResult.clientSecret || null,
          paymentIntentId: validationResult.paymentIntentId || null,
          paymentMethodId: validationResult.paymentMethodId || null
        };
      }
    } catch (error: unknown) {
      if (this.stripeErrorService.isKnownError(error, "payment")) {
        throw this.stripeErrorService.toAppError(error, "payment");
      }
      throw error;
    }

    return null;
  }

  async initializeAndGrantTrialLimits(userId: string): Promise<UserWalletPublicOutput> {
    const { wallet, isNew } = await this.userWalletRepository.accessibleBy(this.authService.ability, "create").getOrCreate({ userId });
    let userWallet = wallet;
    if (!isNew) return this.userWalletRepository.toPublic(userWallet);

    try {
      const wallet = await this.walletManager.createAndAuthorizeTrialSpending(this.managedSignerService, { addressIndex: userWallet.id });
      userWallet = await this.userWalletRepository.updateById(
        userWallet.id,
        {
          address: wallet.address,
          deploymentAllowance: wallet.limits.deployment,
          feeAllowance: wallet.limits.fees
        },
        { returning: true }
      );
    } catch (error) {
      await this.userWalletRepository.deleteById(userWallet.id);
      throw error;
    }

    const walletOutput = this.userWalletRepository.toPublic(userWallet);
    await this.domainEvents.publish(new TrialStarted({ userId }));

    return walletOutput;
  }

  async initialize(userId: string) {
    const { id } = await this.userWalletRepository.create({ userId });
    const wallet = await this.walletManager.createWallet({ addressIndex: id });
    return await this.userWalletRepository.updateById(
      id,
      {
        address: wallet.address
      },
      { returning: true }
    );
  }
}
