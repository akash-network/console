import assert from "http-assert";
import { singleton } from "tsyringe";

import { TrialStarted } from "@src/billing/events/trial-started";
import {
  isWalletInitialized,
  type UserWalletOutput,
  type UserWalletPublicOutput,
  UserWalletRepository,
  type WalletInitialized
} from "@src/billing/repositories";
import { TrialActivationInstrumentationService } from "@src/billing/services/activate-trial/trial-activation-instrumentation.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { OrganizationOutput } from "@src/organization/repositories/organization/organization.repository";
import { UserOutput, UserRepository } from "@src/user/repositories";
import { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";

/** Names the domain, unlike the registration refusal: only a verified account holder sees it, and support needs to be able to act on it. */
export const TRIAL_BLOCKED_DOMAIN_MESSAGE = "Trial is not available for this email domain. Please contact support for assistance.";

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly domainEvents: DomainEventsService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly stripeService: StripeService,
    private readonly userRepository: UserRepository,
    private readonly trialActivationInstrumentation: TrialActivationInstrumentationService,
    private readonly trialValidationService: TrialValidationService,
    private readonly blockedEmailDomainService: BlockedEmailDomainService,
    private readonly txService: TxService
  ) {}

  async #assertNoDuplicateFingerprint(user: UserOutput): Promise<void> {
    if (!this.stripeService.isProduction) return;
    if (!this.featureFlagsService.isEnabled(FeatureFlags.TRIAL_FINGERPRINT_CHECK)) return;
    if (!user.lastFingerprint) return;

    const usersWithSameFingerprint = await this.userRepository.findTrialUsersByFingerprint(user.lastFingerprint, user.id);
    assert(usersWithSameFingerprint.length === 0, 400, "Unable to start trial. Please contact support for assistance.");
  }

  async #assertEmailDomainNotBlocked(user: UserOutput): Promise<void> {
    const blocked = await this.blockedEmailDomainService.isBlockedEmail(user.email);
    assert(!blocked, 400, TRIAL_BLOCKED_DOMAIN_MESSAGE);
  }

  /** Grants the trial to the user's own wallet whatever organization is active, and sets `activatedAt` only once the grants land since the spend gate reads it as ready. */
  async initializeAndGrantTrialLimits(userId: string): Promise<UserWalletPublicOutput> {
    const user = await this.userRepository.findById(userId);
    assert(user, 404, "User Not Found");
    assert(user.emailVerified, 400, "Email not verified");
    await this.#assertNoDuplicateFingerprint(user);

    const userWallet = await this.ensureWallet(userId);
    if (userWallet.activatedAt) return this.#toPublic({ ...userWallet, userId });

    await this.#assertEmailDomainNotBlocked(user);

    const activation = await this.txService.transaction(async () => await this.#grantTrialLimitsOnce(userWallet));
    const activatedWallet = this.#toPublic({ ...activation.wallet, userId, address: userWallet.address });
    if (!activation.isNew) return activatedWallet;

    await this.domainEvents.publish(new TrialStarted({ userId }));
    this.trialActivationInstrumentation.recordActivated(userId, Date.now() - new Date(activation.wallet.createdAt).getTime());

    return activatedWallet;
  }

  /** Holds the wallet row until the grant is saved, so an activation running alongside for the same user finds it activated and grants nothing. */
  async #grantTrialLimitsOnce(userWallet: WalletInitialized): Promise<{ wallet: UserWalletOutput; isNew: boolean }> {
    const wallets = this.userWalletRepository.unscoped("wallet-provisioning");
    const lockedWallet = await wallets.findOneByAndLock({ id: userWallet.id }, { strength: "no key update" });

    assert(lockedWallet, 404, "UserWallet Not Found");
    if (lockedWallet.activatedAt) return { wallet: lockedWallet, isNew: false };

    const chainWallet = await this.walletManager.createAndAuthorizeTrialSpending(this.managedSignerService, { addressIndex: userWallet.id });
    const activatedWallet = await wallets.updateById(
      userWallet.id,
      {
        deploymentAllowance: chainWallet.limits.deployment,
        feeAllowance: chainWallet.limits.fees,
        activatedAt: new Date()
      },
      { returning: true }
    );

    return { wallet: activatedWallet, isNew: true };
  }

  #toPublic(wallet: WalletInitialized & { userId: string }): UserWalletPublicOutput {
    return this.userWalletRepository.toPublic(wallet, this.trialValidationService.getTrialWindow(wallet));
  }

  /**
   * Idempotently guarantees the user has a wallet row with a derived address.
   * Address derivation is pure (no chain transaction), so this is safe to run on every registration.
   * Concurrent calls may both derive the address, but derivation is deterministic per wallet id,
   * so the two updates write the same value and the operation stays idempotent.
   */
  async ensureWallet(userId: string): Promise<WalletInitialized> {
    const { wallet } = await this.userWalletRepository.getOrCreate({ userId });

    return await this.#withDerivedAddress(wallet);
  }

  /** Idempotent like {@link ensureWallet}: a team organization's wallet starts without a trial, ready to fund as soon as the organization exists. */
  async ensureTeamWallet(organization: Pick<OrganizationOutput, "id" | "type">, createdByUserId: string | null): Promise<WalletInitialized> {
    if (organization.type !== "team") {
      throw new Error(`Organization ${organization.id} is not a team organization; a personal organization uses its owner's wallet`);
    }

    const { wallet } = await this.userWalletRepository.getOrCreateForOrganization({ organizationId: organization.id, createdByUserId });

    return await this.#withDerivedAddress(wallet);
  }

  /** The address is derived from the row id and written outside the active organization, which is not the new wallet's when a team is being created. */
  async #withDerivedAddress(wallet: UserWalletOutput): Promise<WalletInitialized> {
    if (isWalletInitialized(wallet)) return wallet;

    const { address } = await this.walletManager.createWallet({ addressIndex: wallet.id });
    await this.userWalletRepository.unscoped("wallet-provisioning").updateById(wallet.id, { address });
    return { ...wallet, address };
  }
}
