import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type { UserRepository } from "@src/user/repositories";
import { FirstPurchaseBonusService } from "./first-purchase-bonus.service";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createOrganization } from "@test/seeders/organization.seeder";
import { createTestUser } from "@test/seeders/user-test.seeder";

const FIRST_PAYMENT_AT = new Date("2026-01-05T12:00:00.000Z");
const WINDOW_CLOSES_AT = new Date("2026-01-12T12:00:00.000Z");
const INSIDE_WINDOW = new Date("2026-01-12T11:00:00.000Z");
const ONE_MS_BEFORE_WINDOW_CLOSES = new Date("2026-01-12T11:59:59.999Z");
const AFTER_WINDOW = new Date("2026-01-12T13:00:00.000Z");

describe(FirstPurchaseBonusService.name, () => {
  describe("getEligibleBonusAmount", () => {
    it("grants nothing for coupon claims without querying the repository", async () => {
      const { service, stripeTransactionRepository } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "coupon_claim" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toEqual({ bonusCents: 0, window: null });
      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus).not.toHaveBeenCalled();
    });

    it("grants nothing below the qualifying amount without querying the repository nor locking anything", async () => {
      const { service, stripeTransactionRepository, userRepository, organizationRepository } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: "org-1" });

      const result = await service.getEligibleBonusAmount(transaction, 9900);

      expect(result).toEqual({ bonusCents: 0, window: null });
      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).not.toHaveBeenCalled();
      expect(userRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(organizationRepository.findOneByAndLock).not.toHaveBeenCalled();
    });

    it("grants nothing for a team's payment whose member has deleted their account, without locking anyone", async () => {
      const { service, stripeTransactionRepository, userRepository, organizationRepository } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", userId: null, organizationId: "org-1" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toEqual({ bonusCents: 0, window: null });
      expect(userRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(organizationRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).not.toHaveBeenCalled();
    });

    it("grants 10% of a qualifying first purchase by a person who never received the bonus, outside any window", async () => {
      const { service } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toEqual({ bonusCents: 1000, window: null });
    });

    it("grants nothing when the paying account completed its first purchase 7 days or more before this one", async () => {
      const { service } = setup({ firstPaymentAt: FIRST_PAYMENT_AT });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", createdAt: WINDOW_CLOSES_AT });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toEqual({ bonusCents: 0, window: null });
    });

    it("grants the bonus to a purchase made 6 days and 23 hours after a small first purchase, however late it settles", async () => {
      const { service } = setup({ firstPaymentAt: FIRST_PAYMENT_AT });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", createdAt: INSIDE_WINDOW });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toEqual({ bonusCents: 1000, window: "small_first_purchase" });
    });

    it("leaves the settling transaction out of the paying account's earlier purchases", async () => {
      const { service, stripeTransactionRepository } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).toHaveBeenCalledWith(
        { userId: transaction.userId },
        { excludeId: transaction.id }
      );
    });

    it("grants nothing when the person already received the bonus", async () => {
      const { service, stripeTransactionRepository } = setup({ personHasBonus: true });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toEqual({ bonusCents: 0, window: null });
      expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus).toHaveBeenCalledWith(transaction.userId);
    });

    it("checks the purchases of the team a transaction was paid for", async () => {
      const team = createOrganization({ type: "team" });
      const { service, stripeTransactionRepository, organizationRepository } = setup({ organization: team });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: team.id });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(organizationRepository.findOneByAndLock).toHaveBeenCalledWith({ id: team.id }, { strength: "no key update" });
      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).toHaveBeenCalledWith({ organizationId: team.id }, expect.anything());
    });

    it("grants nothing to a team's purchase made shortly after the team's small first purchase", async () => {
      const team = createOrganization({ type: "team" });
      const { service } = setup({ organization: team, firstPaymentAt: FIRST_PAYMENT_AT });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: team.id, createdAt: INSIDE_WINDOW });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toEqual({ bonusCents: 0, window: null });
    });

    it("checks the person's own purchases for a transaction paid for a personal organization", async () => {
      const personal = createOrganization({ type: "personal" });
      const { service, stripeTransactionRepository } = setup({ organization: personal });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: personal.id });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).toHaveBeenCalledWith({ userId: transaction.userId }, expect.anything());
    });

    it("checks the person's own purchases without locking an organization for a transaction filed under none", async () => {
      const { service, stripeTransactionRepository, organizationRepository } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: null });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(organizationRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).toHaveBeenCalledWith({ userId: transaction.userId }, expect.anything());
    });

    it("locks the paying organization, then the person, before checking eligibility", async () => {
      const team = createOrganization({ type: "team" });
      const { service, stripeTransactionRepository, userRepository, organizationRepository } = setup({ organization: team });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: team.id });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: transaction.userId }, { strength: "no key update" });
      const [organizationLock] = organizationRepository.findOneByAndLock.mock.invocationCallOrder;
      const [personLock] = userRepository.findOneByAndLock.mock.invocationCallOrder;
      const [accountCheck] = stripeTransactionRepository.findEarliestCompletedPaidTransaction.mock.invocationCallOrder;
      const [personCheck] = stripeTransactionRepository.hasReceivedFirstPurchaseBonus.mock.invocationCallOrder;
      expect(organizationLock).toBeLessThan(personLock);
      expect(personLock).toBeLessThan(accountCheck);
      expect(personLock).toBeLessThan(personCheck);
    });

    it("throws when the user row cannot be locked", async () => {
      const { service, stripeTransactionRepository } = setup({ userLockable: false });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      await expect(service.getEligibleBonusAmount(transaction, 10000)).rejects.toMatchObject({
        status: 500,
        message: "Failed to lock user for first-purchase bonus eligibility",
        userId: transaction.userId
      });
      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).not.toHaveBeenCalled();
    });
  });

  describe("evaluate", () => {
    it("answers eligible without a deadline for an account that never completed a paid purchase", async () => {
      const { service } = setup();

      const eligibility = await service.evaluate({ userId: "user-1" }, "user-1", INSIDE_WINDOW);

      expect(eligibility).toEqual({ eligible: true, endsAt: null, window: null });
    });

    it("answers eligible until 7 days after a personal account's first purchase while that window is open", async () => {
      const { service } = setup({ firstPaymentAt: FIRST_PAYMENT_AT });

      const eligibility = await service.evaluate({ userId: "user-1" }, "user-1", ONE_MS_BEFORE_WINDOW_CLOSES);

      expect(eligibility).toEqual({ eligible: true, endsAt: WINDOW_CLOSES_AT, window: "small_first_purchase" });
    });

    it.each([
      { case: "exactly 7 days", at: WINDOW_CLOSES_AT },
      { case: "more than 7 days", at: AFTER_WINDOW }
    ])("answers not eligible $case after a personal account's first purchase", async ({ at }) => {
      const { service } = setup({ firstPaymentAt: FIRST_PAYMENT_AT });

      const eligibility = await service.evaluate({ userId: "user-1" }, "user-1", at);

      expect(eligibility).toEqual({ eligible: false, endsAt: null, window: null });
    });

    it.each([
      { case: "opens", amount: 9999, expected: { eligible: true, endsAt: WINDOW_CLOSES_AT, window: "small_first_purchase" } },
      { case: "opens no", amount: 10000, expected: { eligible: false, endsAt: null, window: null } }
    ])("$case window after a first purchase of $amount cents", async ({ amount, expected }) => {
      const { service } = setup({ firstPaymentAt: FIRST_PAYMENT_AT, firstPaymentAmount: amount });

      const eligibility = await service.evaluate({ userId: "user-1" }, "user-1", INSIDE_WINDOW);

      expect(eligibility).toEqual(expected);
    });

    it("never opens a window for a team account", async () => {
      const { service } = setup({ firstPaymentAt: FIRST_PAYMENT_AT });

      const eligibility = await service.evaluate({ organizationId: "org-1" }, "user-1", INSIDE_WINDOW);

      expect(eligibility).toEqual({ eligible: false, endsAt: null, window: null });
    });

    it("opens no window for a small first purchase on the personal account of a person who received the bonus on a team", async () => {
      const { service, stripeTransactionRepository } = setup({ firstPaymentAt: FIRST_PAYMENT_AT, personHasBonus: true });

      const eligibility = await service.evaluate({ userId: "user-1" }, "user-1", INSIDE_WINDOW);

      expect(eligibility).toEqual({ eligible: false, endsAt: null, window: null });
      expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus).toHaveBeenCalledWith("user-1");
    });

    it("answers not eligible to a person who received the bonus, even for an account that never paid", async () => {
      const { service } = setup({ personHasBonus: true });

      const eligibility = await service.evaluate({ organizationId: "org-1" }, "user-1", INSIDE_WINDOW);

      expect(eligibility).toEqual({ eligible: false, endsAt: null, window: null });
    });

    it("leaves the given transaction out of the account's purchases", async () => {
      const { service, stripeTransactionRepository } = setup();

      await service.evaluate({ userId: "user-1" }, "user-1", INSIDE_WINDOW, { excludeTransactionId: "transaction-1" });

      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).toHaveBeenCalledWith({ userId: "user-1" }, { excludeId: "transaction-1" });
    });

    it("leaves no transaction out unless asked to", async () => {
      const { service, stripeTransactionRepository } = setup();

      await service.evaluate({ userId: "user-1" }, "user-1", INSIDE_WINDOW);

      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).toHaveBeenCalledWith({ userId: "user-1" }, { excludeId: undefined });
    });
  });

  describe("isEligible", () => {
    it.each([
      { teamHasPaid: false, personHasBonus: false, expected: true },
      { teamHasPaid: true, personHasBonus: false, expected: false },
      { teamHasPaid: false, personHasBonus: true, expected: false },
      { teamHasPaid: true, personHasBonus: true, expected: false }
    ])("returns $expected when the team has paid is $teamHasPaid and the person has a bonus is $personHasBonus", async input => {
      const { service } = setup({ firstPaymentAt: input.teamHasPaid ? FIRST_PAYMENT_AT : undefined, personHasBonus: input.personHasBonus });

      await expect(service.isEligible({ organizationId: "org-1" }, "user-1", INSIDE_WINDOW)).resolves.toBe(input.expected);
    });

    it("asks about the given paying account and person", async () => {
      const { service, stripeTransactionRepository } = setup();

      await service.isEligible({ organizationId: "org-1" }, "user-1");

      expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction).toHaveBeenCalledWith({ organizationId: "org-1" }, expect.anything());
      expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus).toHaveBeenCalledWith("user-1");
    });

    it("answers at the given time", async () => {
      const { service } = setup({ firstPaymentAt: FIRST_PAYMENT_AT });

      await expect(service.isEligible({ userId: "user-1" }, "user-1", INSIDE_WINDOW)).resolves.toBe(true);
    });

    it.each([
      { case: "inside", firstPaymentAt: new Date(Date.now() - 60 * 60 * 1000), expected: true },
      { case: "after", firstPaymentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), expected: false }
    ])("answers now when no time is given, $case the window of a personal account's first purchase", async input => {
      const { service } = setup(input);

      await expect(service.isEligible({ userId: "user-1" }, "user-1")).resolves.toBe(input.expected);
    });
  });

  describe("calculateBonusCents", () => {
    it("returns 0 below the $100 minimum", () => {
      const { service } = setup();

      expect(service.calculateBonusCents(9900)).toBe(0);
      expect(service.calculateBonusCents(0)).toBe(0);
    });

    it("returns 10% of the paid amount at or above the minimum", () => {
      const { service } = setup();

      expect(service.calculateBonusCents(10000)).toBe(1000);
      expect(service.calculateBonusCents(100000)).toBe(10000);
    });

    it("caps the bonus at $100", () => {
      const { service } = setup();

      expect(service.calculateBonusCents(1000000)).toBe(10000);
    });

    it("floors non-round amounts", () => {
      const { service } = setup();

      expect(service.calculateBonusCents(10009)).toBe(1000);
    });
  });

  describe("trackBonusGranted", () => {
    it("tracks the grant with paid and bonus amounts and the window it was earned in", () => {
      const { service, analyticsService } = setup();

      service.trackBonusGranted("user-1", 15000, 1500, "small_first_purchase");

      expect(analyticsService.track).toHaveBeenCalledWith("user-1", "first_purchase_bonus_granted", {
        paid_amount_cents: 15000,
        paid_amount_usd: 150,
        bonus_amount_cents: 1500,
        bonus_amount_usd: 15,
        window: "small_first_purchase"
      });
    });

    it("tracks a grant earned on a first purchase as earned in no window", () => {
      const { service, analyticsService } = setup();

      service.trackBonusGranted("user-1", 15000, 1500, null);

      expect(analyticsService.track).toHaveBeenCalledWith("user-1", "first_purchase_bonus_granted", expect.objectContaining({ window: "none" }));
    });
  });

  describe("recordGrant", () => {
    it("records the bonus on the settling payment and grants it", async () => {
      const { service, stripeTransactionRepository } = setup({ bonusRecordable: true });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const grantedCents = await service.recordGrant(transaction, 1500);

      expect(grantedCents).toBe(1500);
      expect(stripeTransactionRepository.recordFirstPurchaseBonus).toHaveBeenCalledWith(transaction.id, 1500);
    });

    it("grants nothing and writes nothing when no bonus is due", async () => {
      const { service, stripeTransactionRepository } = setup({ bonusRecordable: true });

      const grantedCents = await service.recordGrant(generateDatabaseStripeTransaction({ type: "payment_intent" }), 0);

      expect(grantedCents).toBe(0);
      expect(stripeTransactionRepository.recordFirstPurchaseBonus).not.toHaveBeenCalled();
    });

    it("grants nothing and warns when the person's one-bonus index refuses the bonus", async () => {
      const { service, logger } = setup({ bonusRecordable: false });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const grantedCents = await service.recordGrant(transaction, 1500);

      expect(grantedCents).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith({
        event: "FIRST_PURCHASE_BONUS_REFUSED",
        transactionId: transaction.id,
        userId: transaction.userId,
        bonusAmountCents: 1500
      });
    });
  });

  function setup(input?: {
    firstPaymentAt?: Date;
    firstPaymentAmount?: number;
    personHasBonus?: boolean;
    userLockable?: boolean;
    organization?: OrganizationOutput;
    bonusRecordable?: boolean;
  }) {
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.findEarliestCompletedPaidTransaction.mockResolvedValue(
      input?.firstPaymentAt ? { id: faker.string.uuid(), createdAt: input.firstPaymentAt, amount: input.firstPaymentAmount ?? 2000 } : undefined
    );
    stripeTransactionRepository.hasReceivedFirstPurchaseBonus.mockResolvedValue(input?.personHasBonus ?? false);
    stripeTransactionRepository.recordFirstPurchaseBonus.mockResolvedValue(input?.bonusRecordable ?? true);

    const analyticsService = mock<AnalyticsService>();

    const userRepository = mock<UserRepository>();
    userRepository.findOneByAndLock.mockResolvedValue(input?.userLockable === false ? undefined : createTestUser());

    const organizationRepository = mock<OrganizationRepository>();
    organizationRepository.findOneByAndLock.mockResolvedValue(input?.organization);

    const logger = mock<LoggerService>();

    const service = new FirstPurchaseBonusService(stripeTransactionRepository, analyticsService, userRepository, organizationRepository, () => logger);

    return { service, stripeTransactionRepository, analyticsService, userRepository, organizationRepository, logger };
  }
});
