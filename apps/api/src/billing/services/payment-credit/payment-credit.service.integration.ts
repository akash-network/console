import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StripeTransactionRepository } from "@src/billing/repositories";
import { PaymentCreditRepository } from "@src/billing/repositories/payment-credit/payment-credit.repository";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { PAYMENT_CREDIT_UNDECIDED_ERROR_CODE, PaymentCreditService } from "./payment-credit.service";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe(PaymentCreditService.name, () => {
  const paidCents = 100_00;
  const bonusCents = 10_00;
  const initialLimit = 500_000_000;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when a settlement fails after its credit landed and Stripe redelivers it", () => {
    it.each([
      {
        failure: "the fee allowance is refused",
        failAfterGrant: ({ authorizeSpending }: ChainFakes) => authorizeSpending.mockRejectedValueOnce(new Error("fee tx failed"))
      },
      {
        failure: "the wallet's limits cannot be read back",
        failAfterGrant: ({ refreshUserWalletLimits }: ChainFakes) => refreshUserWalletLimits.mockRejectedValueOnce(new Error("rest unavailable"))
      }
    ])("credits the payment and its bonus once in total when $failure", async ({ failAfterGrant }) => {
      const { chain, fakes, transaction, settle, findCredit } = await setup();
      failAfterGrant(fakes);

      await expect(settle()).rejects.toThrow();
      expect(await findTransactionStatus(transaction.id)).toBe("pending");

      await settle();

      expect(fakes.grant).toHaveBeenCalledTimes(1);
      expect(chain.limit).toBe(initialLimit + (paidCents + bonusCents) * 10000);
      expect(await container.resolve(StripeTransactionRepository).findById(transaction.id)).toMatchObject({ status: "succeeded", bonusAmount: bonusCents });
      expect(await findCredit()).toMatchObject({ status: "landed", amount: paidCents + bonusCents, txHash: "GRANT_HASH" });
    });

    it("leaves credit spent before the redelivery spent", async () => {
      const { chain, fakes, settle } = await setup();
      fakes.refreshUserWalletLimits.mockRejectedValueOnce(new Error("rest unavailable"));
      const spent = 30_000_000;

      await expect(settle()).rejects.toThrow();
      chain.limit -= spent;
      await settle();

      expect(fakes.grant).toHaveBeenCalledTimes(1);
      expect(chain.limit).toBe(initialLimit + (paidCents + bonusCents) * 10000 - spent);
    });
  });

  describe("when the signer cannot tell whether the grant landed", () => {
    it("refuses the redelivery until the grant's hash shows it landed, then settles without granting again", async () => {
      const { chain, fakes, transaction, settle, findCredit } = await setup();
      fakes.grant.mockImplementationOnce(async (_signer, { limit }) => {
        chain.limit = limit;
        throw new TxOutcomeUnknownError("UNDECIDED_HASH");
      });

      await expect(settle()).rejects.toBeInstanceOf(TxOutcomeUnknownError);
      expect(await findCredit()).toMatchObject({ status: "pending", txHash: "UNDECIDED_HASH" });

      fakes.findTx.mockResolvedValueOnce(null);
      await expect(settle()).rejects.toMatchObject({ status: 503, errorCode: PAYMENT_CREDIT_UNDECIDED_ERROR_CODE });

      fakes.findTx.mockResolvedValueOnce({ hash: "UNDECIDED_HASH", code: 0, height: 1, rawLog: "" });
      await settle();

      expect(fakes.grant).toHaveBeenCalledTimes(1);
      expect(chain.limit).toBe(initialLimit + (paidCents + bonusCents) * 10000);
      expect(await findTransactionStatus(transaction.id)).toBe("succeeded");
      expect(await findCredit()).toMatchObject({ status: "landed", txHash: "UNDECIDED_HASH" });
    });
  });

  type ChainFakes = Awaited<ReturnType<typeof setup>>["fakes"];

  async function findTransactionStatus(transactionId: string) {
    return (await container.resolve(StripeTransactionRepository).findById(transactionId))?.status;
  }

  async function setup() {
    const { user } = await seedUserWithWallet({ activatedAt: new Date() });
    const transaction = await container.resolve(StripeTransactionRepository).create({
      userId: user.id,
      type: "payment_intent",
      status: "pending",
      amount: paidCents,
      currency: "usd"
    });
    const stripePaymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
    const chain = { limit: initialLimit };
    const balancesService = container.resolve(BalancesService);
    const managedUserWalletService = container.resolve(ManagedUserWalletService);

    vi.spyOn(container.resolve(AnalyticsService), "track").mockReturnValue(undefined);
    vi.spyOn(balancesService, "retrieveDeploymentLimit").mockImplementation(async () => chain.limit);
    const fakes = {
      refreshUserWalletLimits: vi.spyOn(balancesService, "refreshUserWalletLimits").mockResolvedValue(undefined),
      authorizeSpending: vi.spyOn(managedUserWalletService, "authorizeSpending").mockResolvedValue(undefined),
      grant: vi.spyOn(managedUserWalletService, "authorizeDeploymentSpendingOnly").mockImplementation(async (_signer, { limit }) => {
        chain.limit = limit;
        return { code: 0, hash: "GRANT_HASH", rawLog: "" };
      }),
      findTx: vi.spyOn(container.resolve(TxPresenceService), "findTx").mockResolvedValue(null)
    };

    const settle = () =>
      container.resolve(StripeTransactionService).settleSucceededTransaction({
        transactionId: transaction.id,
        chargeId: undefined,
        paymentMethodType: "card",
        cardBrand: undefined,
        cardLast4: undefined,
        receiptUrl: undefined,
        stripePaymentIntentId,
        paymentAmount: paidCents,
        customerUserId: user.id,
        eventDescription: "payment_intent redelivered",
        isAutoRecharge: false
      });
    const findCredit = () => container.resolve(PaymentCreditRepository).findByTransactionId(transaction.id);

    return { chain, fakes, transaction, settle, findCredit };
  }
});
