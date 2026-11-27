import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { ConfirmTrialCardRequest, TrialCardResponse, TrialCardSetupIntentResponse } from "@src/billing/http-schemas/trial-card.schema";
import { UserWalletRepository } from "@src/billing/repositories";
import { CustomerService } from "@src/billing/services/customer/customer.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import {
  EMAIL_VERIFICATION_REQUIRED_ERROR_CODE,
  TRIAL_EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  TrialEligibilityService
} from "@src/billing/services/trial-eligibility/trial-eligibility.service";
import { TrialCardService } from "@src/workload-abuse/services/trial-card/trial-card.service";

/** The trial belongs to the caller's own wallet and Stripe customer, whichever organization is active. */
@singleton()
export class TrialCardController {
  constructor(
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly trialEligibilityService: TrialEligibilityService,
    private readonly trialCardService: TrialCardService,
    private readonly trialActivationJobService: TrialActivationJobService,
    private readonly customerService: CustomerService,
    private readonly stripeService: StripeService
  ) {}

  @Protected([{ action: "read", subject: "UserWallet" }])
  async getTrialCard(): Promise<TrialCardResponse> {
    const { currentUser } = this.authService;
    const wallet = await this.userWalletRepository.findOneByUserId(currentUser.id);
    const step = wallet?.activatedAt ? "not_required" : await this.trialEligibilityService.findCardStep(currentUser.id);

    return { data: { step } };
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async createSetupIntent(): Promise<TrialCardSetupIntentResponse> {
    assert(this.trialCardService.isOffered(), 404, "Not Found");

    const { currentUser } = this.authService;
    const stripeCustomerId = await this.customerService.getStripeCustomerId({ user: currentUser, stripeCustomerId: currentUser.stripeCustomerId });
    const setupIntent = await this.stripeService.createTrialCardSetupIntent(stripeCustomerId);

    return { data: { id: setupIntent.id, clientSecret: setupIntent.client_secret } };
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async confirm({ data: { setupIntentId } }: ConfirmTrialCardRequest): Promise<TrialCardResponse> {
    const { currentUser } = this.authService;
    assert(currentUser.emailVerified, 403, TRIAL_EMAIL_VERIFICATION_REQUIRED_MESSAGE, { errorCode: EMAIL_VERIFICATION_REQUIRED_ERROR_CODE });

    await this.trialCardService.verify(currentUser, setupIntentId);
    await this.trialActivationJobService.schedule(currentUser.id);

    return { data: { step: "verified" } };
  }
}
