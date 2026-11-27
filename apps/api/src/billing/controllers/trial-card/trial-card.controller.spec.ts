import type Stripe from "stripe";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { CustomerService } from "@src/billing/services/customer/customer.service";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import {
  EMAIL_VERIFICATION_REQUIRED_ERROR_CODE,
  type TrialCardStep,
  type TrialEligibilityService
} from "@src/billing/services/trial-eligibility/trial-eligibility.service";
import type { TrialCardService } from "@src/workload-abuse/services/trial-card/trial-card.service";
import { TrialCardController } from "./trial-card.controller";

import { createUser } from "@test/seeders/user.seeder";

describe(TrialCardController.name, () => {
  describe("getTrialCard", () => {
    it.each<TrialCardStep>(["required", "verified", "not_required"])("answers %s for a wallet that is not activated yet", async step => {
      const { controller, user, userWalletRepository, trialEligibilityService } = setup({ step, wallet: { activatedAt: null } });

      await expect(controller.getTrialCard()).resolves.toEqual({ data: { step } });

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
      expect(trialEligibilityService.findCardStep).toHaveBeenCalledWith(user.id);
    });

    it("answers from the eligibility for a user without a wallet", async () => {
      const { controller } = setup({ step: "required", wallet: undefined });

      await expect(controller.getTrialCard()).resolves.toEqual({ data: { step: "required" } });
    });

    it("asks nothing of a user whose wallet is activated, without reading the hold", async () => {
      const { controller, trialEligibilityService } = setup({ step: "required", wallet: { activatedAt: new Date() } });

      await expect(controller.getTrialCard()).resolves.toEqual({ data: { step: "not_required" } });

      expect(trialEligibilityService.findCardStep).not.toHaveBeenCalled();
    });
  });

  describe("createSetupIntent", () => {
    it("creates a trial card setup intent for the caller's own customer", async () => {
      const { controller, user, customerService, stripeService } = setup({ stripeCustomerId: "cus_personal" });

      await expect(controller.createSetupIntent()).resolves.toEqual({ data: { id: "seti_123", clientSecret: "seti_123_secret" } });

      expect(customerService.getStripeCustomerId).toHaveBeenCalledWith({ user, stripeCustomerId: "cus_personal" });
      expect(stripeService.createTrialCardSetupIntent).toHaveBeenCalledWith("cus_personal");
    });

    it("answers not found without touching stripe while the card step is off", async () => {
      const { controller, customerService, stripeService } = setup({ isOffered: false });

      await expect(controller.createSetupIntent()).rejects.toMatchObject({ status: 404, message: "Not Found" });

      expect(customerService.getStripeCustomerId).not.toHaveBeenCalled();
      expect(stripeService.createTrialCardSetupIntent).not.toHaveBeenCalled();
    });
  });

  describe("confirm", () => {
    it("verifies the card, then asks for the trial to be started", async () => {
      const { controller, user, trialCardService, trialActivationJobService } = setup();

      await expect(controller.confirm({ data: { setupIntentId: "seti_123" } })).resolves.toEqual({ data: { step: "verified" } });

      expect(trialCardService.verify).toHaveBeenCalledWith(user, "seti_123");
      expect(trialActivationJobService.schedule).toHaveBeenCalledWith(user.id);
      expect(trialCardService.verify.mock.invocationCallOrder[0]).toBeLessThan(trialActivationJobService.schedule.mock.invocationCallOrder[0]);
    });

    it("starts no trial for a card that is refused", async () => {
      const { controller, trialCardService, trialActivationJobService } = setup();
      const refusal = new Error("refused");
      trialCardService.verify.mockRejectedValue(refusal);

      await expect(controller.confirm({ data: { setupIntentId: "seti_123" } })).rejects.toBe(refusal);

      expect(trialActivationJobService.schedule).not.toHaveBeenCalled();
    });

    it("asks a caller who has not confirmed their email to confirm it before spending a card", async () => {
      const { controller, trialCardService } = setup({ emailVerified: false });

      await expect(controller.confirm({ data: { setupIntentId: "seti_123" } })).rejects.toMatchObject({
        status: 403,
        errorCode: EMAIL_VERIFICATION_REQUIRED_ERROR_CODE
      });

      expect(trialCardService.verify).not.toHaveBeenCalled();
    });
  });

  function setup(
    input: {
      step?: TrialCardStep;
      wallet?: Pick<UserWalletOutput, "activatedAt">;
      isOffered?: boolean;
      emailVerified?: boolean;
      stripeCustomerId?: string;
    } = {}
  ) {
    const user = createUser({ emailVerified: input.emailVerified ?? true, stripeCustomerId: input.stripeCustomerId ?? "cus_personal" });
    const authService = mock<AuthService>({ currentUser: user, isAuthenticated: true });
    container.register(AuthService, { useValue: authService });
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByUserId.mockResolvedValue("wallet" in input && input.wallet ? mock<UserWalletOutput>(input.wallet) : undefined);
    const trialEligibilityService = mock<TrialEligibilityService>();
    trialEligibilityService.findCardStep.mockResolvedValue(input.step ?? "not_required");
    const trialCardService = mock<TrialCardService>({ isOffered: vi.fn(() => input.isOffered ?? true) });
    const trialActivationJobService = mock<TrialActivationJobService>();
    const customerService = mock<CustomerService>();
    customerService.getStripeCustomerId.mockImplementation(async payer => payer.stripeCustomerId ?? "cus_created");
    const stripeService = mock<StripeService>();
    stripeService.createTrialCardSetupIntent.mockResolvedValue(mock<Stripe.Response<Stripe.SetupIntent>>({ id: "seti_123", client_secret: "seti_123_secret" }));
    const controller = new TrialCardController(
      authService,
      userWalletRepository,
      trialEligibilityService,
      trialCardService,
      trialActivationJobService,
      customerService,
      stripeService
    );

    return { controller, user, userWalletRepository, trialEligibilityService, trialCardService, trialActivationJobService, customerService, stripeService };
  }
});
