import { faker } from "@faker-js/faker";
import { subHours } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StripeTransactionRepository, UserWalletRepository } from "@src/billing/repositories";
import { PaymentCreditRepository } from "@src/billing/repositories/payment-credit/payment-credit.repository";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { ReconcileDeploymentAllowanceHandler } from "@src/billing/services/reconcile-deployment-allowance/reconcile-deployment-allowance.handler";
import { ReconcileDeploymentAllowance } from "@src/billing/services/reconcile-deployment-allowance/reconcile-deployment-allowance.job";
import { CREDIT_IN_FLIGHT_ERROR_CODE, RefillService } from "@src/billing/services/refill/refill.service";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { deleteQueuedJobs, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";
import { holdTransaction, waitForLockWait } from "@test/services/lock-wait";

const CHECK = ReconcileDeploymentAllowance[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(ReconcileDeploymentAllowanceHandler)]);

describe(RefillService.name, () => {
  const initialLimit = 500_000_000;
  const refundCents = 20_00;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("topUpWallet", () => {
    it("holds a team's credit behind a deletion that has locked the team's wallet, then refuses it once the deletion commits", async () => {
      const { team, owner, wallet, authorizeSpending } = await setup();
      const deletion = holdTransaction(async () => {
        await container.resolve(OrganizationRepository).findOneByAndLock({ id: team.id });
        await container.resolve(UserWalletRepository).findOneByAndLock({ id: wallet.id });
        await container.resolve(OrganizationRepository).updateById(team.id, { deletedAt: new Date() });
      });
      await deletion.held;

      const crediting = container
        .resolve(TxService)
        .transaction(() =>
          container
            .resolve(RefillService)
            .topUpWallet(1000, { userId: owner.id, organizationId: team.id, team }, { payment: { transactionId: faker.string.uuid() } })
        );
      await waitForLockWait('select %from "user_wallets"%for update');
      deletion.release();
      await deletion.committed;

      await expect(crediting).rejects.toMatchObject({ status: 409, errorCode: "organization_deleted" });
      expect(authorizeSpending).not.toHaveBeenCalled();
    });
  });

  describe("reduceWalletBalance", () => {
    afterEach(async () => {
      await deleteQueuedJobs(CHECK);
    });

    it("waits for a credit to the same wallet that is still landing", async () => {
      const { chain, refund, creditInFlight, findChecks } = await setupRefund();
      await creditInFlight();

      await expect(refund()).rejects.toMatchObject({ status: 409, errorCode: CREDIT_IN_FLIGHT_ERROR_CODE });

      expect(chain.limit).toBe(initialLimit);
      expect(await findChecks()).toEqual([]);
    });

    it("debits the refund once that credit has landed, and has its own grant checked", async () => {
      const { chain, wallet, refund, creditInFlight, findChecks } = await setupRefund();
      const credit = await creditInFlight();
      await container.resolve(PaymentCreditRepository).markLanded(credit.transactionId, "CREDIT_HASH");

      await refund();

      expect(chain.limit).toBe(initialLimit - refundCents * 10000);
      expect(await findChecks()).toEqual([
        expect.objectContaining({
          data: expect.objectContaining({
            wallet: { id: wallet.id, address: wallet.address },
            write: expect.objectContaining({ txHash: chain.lastHash, readHeight: chain.height, readLimit: initialLimit }),
            adjustment: 0
          })
        })
      ]);
    });

    it("debits the refund past a credit whose grant can no longer land", async () => {
      const { chain, refund, creditInFlight } = await setupRefund();
      const credit = await creditInFlight();
      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .update(resolveTable("PaymentCredits"))
        .set({ createdAt: subHours(new Date(), 2) })
        .where(eq(resolveTable("PaymentCredits").transactionId, credit.transactionId));

      await refund();

      expect(chain.limit).toBe(initialLimit - refundCents * 10000);
    });

    it("debits the refund whatever credit is landing on another wallet", async () => {
      const { chain, refund, creditInFlight } = await setupRefund();
      await creditInFlight({ address: createAkashAddress() });

      await refund();

      expect(chain.limit).toBe(initialLimit - refundCents * 10000);
    });
  });

  async function setup() {
    const { organization: team, user: owner } = await seedOrganizationWithOwner();
    const [wallet] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId: team.id, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
      .returning();
    const authorizeSpending = vi.spyOn(container.resolve(ManagedUserWalletService), "authorizeSpending").mockResolvedValue();

    return { team, owner, wallet, authorizeSpending };
  }

  async function setupRefund() {
    await jobWorkers();
    const { user, wallet } = await seedUserWithWallet({ activatedAt: new Date() });
    const chain = { limit: initialLimit, height: faker.number.int({ min: 1_000, max: 1_000_000 }), lastHash: "" };
    const balancesService = container.resolve(BalancesService);
    const managedUserWalletService = container.resolve(ManagedUserWalletService);

    vi.spyOn(container.resolve(AnalyticsService), "track").mockReturnValue(undefined);
    vi.spyOn(balancesService, "retrieveDeploymentLimitAtLatestHeight").mockImplementation(async () => ({ limit: chain.limit, height: chain.height }));
    vi.spyOn(balancesService, "refreshUserWalletLimits").mockResolvedValue(undefined);
    vi.spyOn(managedUserWalletService, "authorizeSpending").mockResolvedValue(undefined);
    vi.spyOn(managedUserWalletService, "authorizeDeploymentSpendingOnly").mockImplementation(async (_signer, { limit }) => {
      chain.limit = limit;
      chain.lastHash = faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase();
      return { code: 0, hash: chain.lastHash, rawLog: "" };
    });

    const creditInFlight = async ({ address = wallet.address! }: { address?: string } = {}) => {
      const payment = await container
        .resolve(StripeTransactionRepository)
        .create({ userId: user.id, type: "payment_intent", status: "pending", amount: 50_00, currency: "usd" });
      await container.resolve(PaymentCreditRepository).createPending({ transactionId: payment.id, address, amount: 50_00, bonusAmount: 0 });

      return { transactionId: payment.id };
    };

    const refund = () => container.resolve(RefillService).reduceWalletBalance(refundCents, { userId: user.id });
    const findChecks = () => findJobRows(CHECK, { singletonKeyLike: `${CHECK}.%`, data: {}, state: "created" });

    return { chain, wallet, refund, creditInFlight, findChecks };
  }
});
