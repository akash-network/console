import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { hashCard } from "@src/workload-abuse/lib/account-hashes/account-hashes";
import type { TrialCardRepository } from "@src/workload-abuse/repositories/trial-card/trial-card.repository";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TRIAL_CARD_REFUSALS, TrialCardService } from "./trial-card.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const SECRET = "a".repeat(32);
const SETUP_INTENT_ID = "seti_trial_card";

describe(TrialCardService.name, () => {
  describe("isOffered", () => {
    it("follows the switch", () => {
      expect(setup({ step: "on" }).service.isOffered()).toBe(true);
      expect(setup({ step: "off" }).service.isOffered()).toBe(false);
    });
  });

  describe("hasVerifiedCard", () => {
    it("answers yes for a user with a card on record", async () => {
      const { service, user, repository } = setup({ hasCardOnRecord: true });

      await expect(service.hasVerifiedCard(user.id)).resolves.toBe(true);
      expect(repository.existsForUser).toHaveBeenCalledWith(user.id);
    });

    it("answers no for a user without one", async () => {
      const { service, user } = setup({ hasCardOnRecord: false });

      await expect(service.hasVerifiedCard(user.id)).resolves.toBe(false);
    });

    it("answers no without reading while the step is off", async () => {
      const { service, user, repository } = setup({ step: "off", hasCardOnRecord: true });

      await expect(service.hasVerifiedCard(user.id)).resolves.toBe(false);
      expect(repository.existsForUser).not.toHaveBeenCalled();
    });
  });

  describe("verify", () => {
    it("spends a verified card on the user's trial under its keyed hash", async () => {
      const { service, user, repository, stripeService, logger } = setup({ card: { fingerprint: "fp_visa", funding: "credit" } });

      await expect(service.verify(user, SETUP_INTENT_ID)).resolves.toBeUndefined();

      expect(stripeService.retrieveSetupIntentWithPaymentMethod).toHaveBeenCalledWith(SETUP_INTENT_ID);
      expect(repository.claim).toHaveBeenCalledWith({ cardHash: hashCard(SECRET, "fp_visa"), userId: user.id });
      expect(logger.info).toHaveBeenCalledWith({ event: "TRIAL_CARD_VERIFIED", userId: user.id });
    });

    it("accepts a debit card", async () => {
      const { service, user, repository } = setup({ card: { fingerprint: "fp_debit", funding: "debit" } });

      await service.verify(user, SETUP_INTENT_ID);

      expect(repository.claim).toHaveBeenCalledTimes(1);
    });

    it("refuses a card that already started another account's trial", async () => {
      const { service, user, logger } = setup({ claimedByUserId: faker.string.uuid() });

      await expect(service.verify(user, SETUP_INTENT_ID)).rejects.toMatchObject({
        status: 422,
        errorCode: "trial_card_already_used",
        message: TRIAL_CARD_REFUSALS.trial_card_already_used
      });
      expect(logger.info).toHaveBeenCalledWith({ event: "TRIAL_CARD_REFUSED", userId: user.id, refusal: "trial_card_already_used" });
      expect(logger.info).not.toHaveBeenCalledWith({ event: "TRIAL_CARD_VERIFIED", userId: user.id });
    });

    it("refuses a prepaid card without spending it", async () => {
      const { service, user, repository } = setup({ card: { fingerprint: "fp_prepaid", funding: "prepaid" } });

      await expect(service.verify(user, SETUP_INTENT_ID)).rejects.toMatchObject({
        status: 422,
        errorCode: "trial_card_prepaid",
        message: TRIAL_CARD_REFUSALS.trial_card_prepaid
      });
      expect(repository.claim).not.toHaveBeenCalled();
    });

    it.each([
      { name: "the setup intent has not succeeded", setupIntent: { status: "requires_action" as const } },
      { name: "the setup intent was not created for a trial card", setupIntent: { metadata: {} } },
      { name: "the setup intent carries no metadata", setupIntent: { metadata: null } }
    ])("refuses a card as not verified when $name", async ({ setupIntent }) => {
      const { service, user, repository } = setup({ setupIntent });

      await expect(service.verify(user, SETUP_INTENT_ID)).rejects.toMatchObject({
        status: 422,
        errorCode: "trial_card_not_verified",
        message: TRIAL_CARD_REFUSALS.trial_card_not_verified
      });
      expect(repository.claim).not.toHaveBeenCalled();
    });

    it.each([
      { name: "the payment method is not a card", paymentMethod: mock<Stripe.PaymentMethod>({ type: "link", card: undefined }) },
      { name: "the payment method was not expanded", paymentMethod: "pm_unexpanded" },
      { name: "the setup intent has no payment method", paymentMethod: null },
      {
        name: "the card has no fingerprint",
        paymentMethod: mock<Stripe.PaymentMethod>({ type: "card", card: mock<Stripe.PaymentMethod.Card>({ fingerprint: null, funding: "credit" }) })
      },
      {
        name: "a card object rides on another payment method type",
        paymentMethod: mock<Stripe.PaymentMethod>({ type: "link", card: mock<Stripe.PaymentMethod.Card>({ fingerprint: "fp_visa", funding: "credit" }) })
      }
    ])("refuses the payment method as unsupported when $name", async ({ paymentMethod }) => {
      const { service, user, repository } = setup({ setupIntent: { payment_method: paymentMethod } });

      await expect(service.verify(user, SETUP_INTENT_ID)).rejects.toMatchObject({
        status: 422,
        errorCode: "trial_card_unsupported",
        message: TRIAL_CARD_REFUSALS.trial_card_unsupported
      });
      expect(repository.claim).not.toHaveBeenCalled();
    });

    it("answers not found for a setup intent of another customer, expanded or not", async () => {
      const byId = setup({ setupIntent: { customer: "cus_someone_else" } });
      const expanded = setup({ setupIntent: { customer: mock<Stripe.Customer>({ id: "cus_someone_else" }) } });

      await expect(byId.service.verify(byId.user, SETUP_INTENT_ID)).rejects.toMatchObject({ status: 404, message: "Setup intent not found" });
      await expect(expanded.service.verify(expanded.user, SETUP_INTENT_ID)).rejects.toMatchObject({ status: 404 });
      expect(byId.repository.claim).not.toHaveBeenCalled();
    });

    it("accepts a setup intent whose customer comes back expanded", async () => {
      const { service, user, repository } = setup({ setupIntent: { customer: mock<Stripe.Customer>({ id: "cus_trial" }) } });

      await service.verify(user, SETUP_INTENT_ID);

      expect(repository.claim).toHaveBeenCalledTimes(1);
    });

    it("answers not found for a setup intent without a customer, or a user without one", async () => {
      const noCustomer = setup({ setupIntent: { customer: null } });
      const noUserCustomer = setup({ stripeCustomerId: null, setupIntent: { customer: null } });

      await expect(noCustomer.service.verify(noCustomer.user, SETUP_INTENT_ID)).rejects.toMatchObject({ status: 404 });
      await expect(noUserCustomer.service.verify(noUserCustomer.user, SETUP_INTENT_ID)).rejects.toMatchObject({ status: 404 });
    });

    it("answers not found for a setup intent stripe does not know", async () => {
      const { service, user, stripeService } = setup();
      stripeService.retrieveSetupIntentWithPaymentMethod.mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "resource_missing", message: "No such setupintent" })
      );

      await expect(service.verify(user, SETUP_INTENT_ID)).rejects.toMatchObject({ status: 404, message: "Setup intent not found" });
    });

    it("passes on any other stripe failure", async () => {
      const invalidRequest = setup();
      const invalid = new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "parameter_invalid_string", message: "Invalid id" });
      invalidRequest.stripeService.retrieveSetupIntentWithPaymentMethod.mockRejectedValue(invalid);
      const outage = setup();
      const unavailable = new Stripe.errors.StripeAPIError({ type: "api_error", code: "resource_missing", message: "Stripe is down" });
      outage.stripeService.retrieveSetupIntentWithPaymentMethod.mockRejectedValue(unavailable);

      await expect(invalidRequest.service.verify(invalidRequest.user, SETUP_INTENT_ID)).rejects.toBe(invalid);
      await expect(outage.service.verify(outage.user, SETUP_INTENT_ID)).rejects.toBe(unavailable);
    });

    it("answers not found without calling stripe while the step is off", async () => {
      const { service, user, stripeService } = setup({ step: "off" });

      await expect(service.verify(user, SETUP_INTENT_ID)).rejects.toMatchObject({ status: 404, message: "Not Found" });
      expect(stripeService.retrieveSetupIntentWithPaymentMethod).not.toHaveBeenCalled();
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: TrialCardService.name });
  });

  function setup(
    input: {
      step?: "off" | "on";
      hasCardOnRecord?: boolean;
      stripeCustomerId?: string | null;
      card?: { fingerprint: string; funding: string };
      claimedByUserId?: string;
      setupIntent?: Partial<Stripe.SetupIntent>;
    } = {}
  ) {
    const user = { id: faker.string.uuid(), stripeCustomerId: "stripeCustomerId" in input ? input.stripeCustomerId ?? null : "cus_trial" };
    const card = input.card ?? { fingerprint: "fp_visa", funding: "credit" };
    const setupIntent = mock<Stripe.SetupIntent>({
      id: SETUP_INTENT_ID,
      status: "succeeded",
      customer: "cus_trial",
      metadata: { trial_card: "true" },
      payment_method: mock<Stripe.PaymentMethod>({ type: "card", card: mock<Stripe.PaymentMethod.Card>(card) }),
      ...input.setupIntent
    });
    const stripeService = mock<StripeService>();
    stripeService.retrieveSetupIntentWithPaymentMethod.mockResolvedValue(setupIntent);
    const repository = mock<TrialCardRepository>();
    repository.existsForUser.mockResolvedValue(input.hasCardOnRecord ?? false);
    repository.claim.mockImplementation(async claim => ({
      id: faker.string.uuid(),
      cardHash: claim.cardHash,
      userId: input.claimedByUserId ?? claim.userId,
      createdAt: new Date()
    }));
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET: SECRET,
      WORKLOAD_ABUSE_HELD_TRIAL_CARD_STEP: input.step ?? "on"
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new TrialCardService(repository, stripeService, config, createLogger);

    return { service, user, repository, stripeService, logger, createLogger };
  }
});
