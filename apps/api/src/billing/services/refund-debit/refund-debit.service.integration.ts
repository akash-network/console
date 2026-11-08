import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StripeTransactionRepository } from "@src/billing/repositories";
import { RefundDebitRepository } from "@src/billing/repositories/refund-debit/refund-debit.repository";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { ReconcileDeploymentAllowanceHandler } from "@src/billing/services/reconcile-deployment-allowance/reconcile-deployment-allowance.handler";
import { ReconcileDeploymentAllowance } from "@src/billing/services/reconcile-deployment-allowance/reconcile-deployment-allowance.job";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import { JOB_NAME } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { REFUND_DEBIT_UNDECIDED_ERROR_CODE, RefundDebitService } from "./refund-debit.service";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { deleteQueuedJobs, useJobWorkers } from "@test/services/job-queue-harness";

const CHECK = ReconcileDeploymentAllowance[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(ReconcileDeploymentAllowanceHandler)]);

describe(RefundDebitService.name, () => {
  const paidCents = 100_00;
  const bonusCents = 10_00;
  const initialLimit = 2_000_000_000;

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteQueuedJobs(CHECK);
  });

  it("lowers the allowance by the refund and its bonus clawback once, however often the refund is delivered", async () => {
    const { chain, fakes, payment, refund, findDebits } = await setup();

    await refund(paidCents);
    await refund(paidCents);

    expect(fakes.grant).toHaveBeenCalledTimes(1);
    expect(chain.limit).toBe(initialLimit - (paidCents + bonusCents) * 10000);
    expect(await findPayment(payment.id)).toMatchObject({ status: "refunded", amountRefunded: paidCents });
    expect(await findDebits()).toEqual([
      expect.objectContaining({ amountRefunded: paidCents, status: "landed", amount: paidCents + bonusCents, txHash: "DEBIT_HASH" })
    ]);
  });

  describe("when a refund fails after its debit landed and Stripe redelivers it", () => {
    it.each([
      {
        failure: "the fee allowance is refused",
        failAfterDebit: ({ authorizeSpending }: ChainFakes) => authorizeSpending.mockRejectedValueOnce(new Error("fee tx failed"))
      },
      {
        failure: "the wallet's limits cannot be read back",
        failAfterDebit: ({ refreshUserWalletLimits }: ChainFakes) => refreshUserWalletLimits.mockRejectedValueOnce(new Error("rest unavailable"))
      }
    ])("lowers the allowance once in total when $failure", async ({ failAfterDebit }) => {
      const { chain, fakes, payment, refund, findDebits } = await setup();
      failAfterDebit(fakes);

      await expect(refund(paidCents)).rejects.toThrow();
      expect(await findPayment(payment.id)).toMatchObject({ status: "succeeded", amountRefunded: 0 });

      await refund(paidCents);

      expect(fakes.grant).toHaveBeenCalledTimes(1);
      expect(chain.limit).toBe(initialLimit - (paidCents + bonusCents) * 10000);
      expect(fakes.authorizeSpending).toHaveBeenCalledTimes(2);
      expect(await findPayment(payment.id)).toMatchObject({ status: "refunded", amountRefunded: paidCents });
      expect(await findDebits()).toEqual([expect.objectContaining({ amountRefunded: paidCents, status: "landed", amount: paidCents + bonusCents })]);
    });

    it("debits only the rest of a later refund of the payment that arrives before the redelivery", async () => {
      const { chain, fakes, payment, refund, findDebits } = await setup();
      fakes.authorizeSpending.mockRejectedValueOnce(new Error("fee tx failed"));

      await expect(refund(30_00)).rejects.toThrow();
      await refund(50_00);
      await refund(30_00);

      expect(chain.limit).toBe(initialLimit - 50_00 * 10000);
      expect(await findPayment(payment.id)).toMatchObject({ status: "succeeded", amountRefunded: 50_00 });
      expect(await findDebits()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amountRefunded: 30_00, status: "landed", amount: 30_00 }),
          expect.objectContaining({ amountRefunded: 50_00, status: "landed", amount: 20_00 })
        ])
      );
    });
  });

  it("debits the refund in full on redelivery when its debit failed", async () => {
    const { chain, fakes, payment, refund, findDebits } = await setup();
    fakes.grant.mockRejectedValueOnce(new Error("signer refused the grant"));

    await expect(refund(paidCents)).rejects.toThrow("signer refused the grant");
    expect(chain.limit).toBe(initialLimit);
    expect(await findDebits()).toEqual([]);

    await refund(paidCents);

    expect(fakes.grant).toHaveBeenCalledTimes(2);
    expect(chain.limit).toBe(initialLimit - (paidCents + bonusCents) * 10000);
    expect(await findPayment(payment.id)).toMatchObject({ status: "refunded", amountRefunded: paidCents });
    expect(await findDebits()).toEqual([expect.objectContaining({ status: "landed", amount: paidCents + bonusCents })]);
  });

  describe("when the signer cannot tell whether the debit landed", () => {
    it("refuses the redelivery until the debit's hash shows it landed, then finishes the refund without debiting again", async () => {
      const { chain, fakes, payment, refund, findDebits } = await setup();
      fakes.grant.mockImplementationOnce(async (_signer, { limit }) => {
        chain.limit = limit;
        throw new TxOutcomeUnknownError("UNDECIDED_HASH");
      });

      await expect(refund(paidCents)).rejects.toBeInstanceOf(TxOutcomeUnknownError);
      expect(await findDebits()).toEqual([expect.objectContaining({ status: "pending", txHash: "UNDECIDED_HASH" })]);

      fakes.findTx.mockResolvedValueOnce(null);
      await expect(refund(paidCents)).rejects.toMatchObject({ status: 503, errorCode: REFUND_DEBIT_UNDECIDED_ERROR_CODE });

      fakes.findTx.mockResolvedValueOnce({ hash: "UNDECIDED_HASH", code: 0, height: 1, rawLog: "" });
      await refund(paidCents);

      expect(fakes.grant).toHaveBeenCalledTimes(1);
      expect(chain.limit).toBe(initialLimit - (paidCents + bonusCents) * 10000);
      expect(await findPayment(payment.id)).toMatchObject({ status: "refunded", amountRefunded: paidCents });
      expect(await findDebits()).toEqual([expect.objectContaining({ status: "landed", txHash: "UNDECIDED_HASH" })]);
    });
  });

  type ChainFakes = Awaited<ReturnType<typeof setup>>["fakes"];

  async function findPayment(transactionId: string) {
    return await container.resolve(StripeTransactionRepository).findById(transactionId);
  }

  async function setup() {
    await jobWorkers();
    const { user } = await seedUserWithWallet({ activatedAt: new Date() });
    const chargeId = `ch_${faker.string.alphanumeric(24)}`;
    const payment = await container.resolve(StripeTransactionRepository).create({
      userId: user.id,
      type: "payment_intent",
      status: "succeeded",
      amount: paidCents,
      bonusAmount: bonusCents,
      currency: "usd",
      stripeChargeId: chargeId,
      stripePaymentIntentId: `pi_${faker.string.alphanumeric(24)}`
    });
    const chain = { limit: initialLimit, height: faker.number.int({ min: 1_000, max: 1_000_000 }) };
    const balancesService = container.resolve(BalancesService);
    const managedUserWalletService = container.resolve(ManagedUserWalletService);

    vi.spyOn(container.resolve(AnalyticsService), "track").mockReturnValue(undefined);
    vi.spyOn(balancesService, "retrieveDeploymentLimitAtLatestHeight").mockImplementation(async () => ({ limit: chain.limit, height: chain.height }));
    const fakes = {
      refreshUserWalletLimits: vi.spyOn(balancesService, "refreshUserWalletLimits").mockResolvedValue(undefined),
      authorizeSpending: vi.spyOn(managedUserWalletService, "authorizeSpending").mockResolvedValue(undefined),
      grant: vi.spyOn(managedUserWalletService, "authorizeDeploymentSpendingOnly").mockImplementation(async (_signer, { limit }) => {
        chain.limit = limit;
        return { code: 0, hash: "DEBIT_HASH", rawLog: "" };
      }),
      findTx: vi.spyOn(container.resolve(TxPresenceService), "findTx").mockResolvedValue(null)
    };

    const refund = (amountRefunded: number) =>
      container.resolve(StripeTransactionService).applyRefund({
        chargeId,
        paymentIntentId: payment.stripePaymentIntentId ?? undefined,
        amountRefunded,
        fullyRefunded: amountRefunded === paidCents,
        customerOwner: { user }
      });
    const findDebits = () => container.resolve(RefundDebitRepository).findRefundedBeyond(payment.id, 0);

    return { chain, fakes, payment, refund, findDebits };
  }
});
