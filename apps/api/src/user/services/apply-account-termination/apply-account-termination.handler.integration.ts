import { AuthzHttpService, DeploymentHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { addHours } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import { singletonKeyOf } from "@src/billing/lib/wallet-billing-target/wallet-billing-target";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { WalletBalanceReloadCheckHandler } from "@src/billing/services/wallet-balance-reload-check/wallet-balance-reload-check.handler";
import { WalletCreditsLowCheckHandler } from "@src/billing/services/wallet-credits-low-check/wallet-credits-low-check.handler";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import type { AccountStatus } from "@src/user/lib/account-status/account-status";
import { ApplyAccountTerminationHandler } from "./apply-account-termination.handler";
import { ApplyAccountTermination, applyAccountTerminationKeyFor } from "./apply-account-termination.job";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const FUNDING_WALLET = "akash1funding";

const jobWorkers = useJobWorkers(() => [
  container.resolve(ApplyAccountTerminationHandler),
  container.resolve(WalletBalanceReloadCheckHandler),
  container.resolve(WalletCreditsLowCheckHandler)
]);

describe(ApplyAccountTerminationHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes deployments, turns off auto-recharge, and keeps allowances when forfeitCredits is false", async () => {
    const { user, wallet, close, executeFundingTx, run, findWallet, findWalletSetting, findChecks } = await setup({ openDseqs: ["11", "22"] });

    await run({ forfeitCredits: false });

    expect(close).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id, address: wallet.address }), "11", { reason: null });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id, address: wallet.address }), "22", { reason: null });
    expect((await findWalletSetting()).autoReloadEnabled).toBe(false);
    expect(await findChecks()).toEqual({ reload: ["cancelled"], creditsLow: ["cancelled"] });
    expect(await findWallet()).toMatchObject({ deploymentAllowance: "25000000.00", feeAllowance: "7000000.00", abuseLockedAt: null });
    expect(executeFundingTx).not.toHaveBeenCalled();
    expect(user.accountStatus).toBe("terminated");
  });

  it("revokes grants and zeroes allowances when forfeitCredits is true, after closing the deployments, without locking the wallet", async () => {
    const { wallet, calls, run, findWallet } = await setup({ openDseqs: ["11"] });

    await run({ forfeitCredits: true });

    expect(calls).toEqual(["close:11", "revoke:deposit", "revoke:fee"]);
    expect(await findWallet()).toMatchObject({
      deploymentAllowance: "0.00",
      feeAllowance: "0.00",
      isTrialing: wallet.isTrialing,
      abuseLockedAt: null,
      abuseLockedReason: null
    });
  });

  it("finishes a forfeit whose grants an earlier run already revoked", async () => {
    const { run, findWallet, executeFundingTx } = await setup({ openDseqs: [], grantsOnChain: false });

    await run({ forfeitCredits: true });

    expect(executeFundingTx).not.toHaveBeenCalled();
    expect(await findWallet()).toMatchObject({ deploymentAllowance: "0.00", feeAllowance: "0.00" });
  });

  it("never touches stripe transactions or the stripe customer", async () => {
    const { user, run, db } = await setup({ openDseqs: ["11"] });
    const transactions = resolveTable("StripeTransactions");
    const users = resolveTable("Users");
    await db.insert(transactions).values({ userId: user.id, type: "payment_intent", amount: 2500, status: "succeeded" });
    const transactionsBefore = await db.select().from(transactions).where(eq(transactions.userId, user.id));

    await run({ forfeitCredits: true });

    expect(await db.select().from(transactions).where(eq(transactions.userId, user.id))).toEqual(transactionsBefore);
    expect((await db.select({ stripeCustomerId: users.stripeCustomerId }).from(users).where(eq(users.id, user.id)))[0]).toEqual({
      stripeCustomerId: user.stripeCustomerId
    });
  });

  it.each(["active", "suspended"] as const)("leaves a %s account alone, as after a terminate that rolled back", async accountStatus => {
    const { handler, user, close, findWallet, findWalletSetting } = await setup({ openDseqs: ["11"], accountStatus });

    await handler.handle({ userId: user.id, forfeitCredits: true, version: 1 });

    expect(close).not.toHaveBeenCalled();
    expect((await findWalletSetting()).autoReloadEnabled).toBe(true);
    expect(await findWallet()).toMatchObject({ deploymentAllowance: "25000000.00" });
  });

  it("does nothing for a user that no longer exists", async () => {
    const { handler, findAll } = await setup({ openDseqs: ["11"] });

    await handler.handle({ userId: faker.string.uuid(), forfeitCredits: true, version: 1 });

    expect(findAll).not.toHaveBeenCalled();
  });

  async function setup(input: { openDseqs: string[]; accountStatus?: AccountStatus; grantsOnChain?: boolean }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const calls: string[] = [];
    const { user, wallet, address } = await seedUserWithWallet({
      user: { accountStatus: input.accountStatus ?? "terminated", stripeCustomerId: `cus_${faker.string.alphanumeric(14)}` },
      deploymentAllowance: "25000000",
      feeAllowance: "7000000"
    });
    const setting = await seedWalletSetting({ userId: user.id, walletId: wallet.id, autoReloadEnabled: true, autoReloadThreshold: 1500 });
    const target = { userId: user.id };
    await enqueue(new WalletBalanceReloadCheck(target), {
      singletonKey: singletonKeyOf(WalletBalanceReloadCheck[JOB_NAME], target),
      startAfter: addHours(new Date(), 1)
    });
    await enqueue(new WalletCreditsLowCheck(target), {
      singletonKey: singletonKeyOf(WalletCreditsLowCheck[JOB_NAME], target),
      startAfter: addHours(new Date(), 1)
    });

    const findAll = vi.spyOn(container.resolve(DeploymentHttpService), "findAll").mockResolvedValue({
      deployments: input.openDseqs.map(dseq => createDeploymentInfoSeed({ owner: address, dseq })),
      pagination: { next_key: null, total: String(input.openDseqs.length) }
    });
    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockImplementation(async (_wallet, dseq) => {
      calls.push(`close:${dseq}`);
      return true;
    });
    vi.spyOn(container.resolve(TxManagerService), "getFundingWalletAddress").mockResolvedValue(FUNDING_WALLET);
    vi.spyOn(container.resolve(AuthzHttpService), "hasDepositDeploymentGrant").mockResolvedValue(input.grantsOnChain ?? true);
    vi.spyOn(container.resolve(AuthzHttpService), "hasFeeAllowance").mockResolvedValue(input.grantsOnChain ?? true);
    const executeFundingTx = vi.spyOn(container.resolve(ManagedSignerService), "executeFundingTx").mockImplementation(async ([message]) => {
      calls.push(message.typeUrl.includes("feegrant") ? "revoke:fee" : "revoke:deposit");
      return mock<Awaited<ReturnType<ManagedSignerService["executeFundingTx"]>>>();
    });

    async function run({ forfeitCredits }: { forfeitCredits: boolean }) {
      await enqueue(new ApplyAccountTermination({ userId: user.id, forfeitCredits }), { singletonKey: applyAccountTerminationKeyFor(user.id) });
      await startWorkers();
      await expectJobCompleted(ApplyAccountTermination[JOB_NAME], { singletonKey: applyAccountTerminationKeyFor(user.id) });
    }

    async function findWallet() {
      const wallets = resolveTable("UserWallets");
      const [found] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
      return found;
    }

    async function findWalletSetting() {
      const settings = resolveTable("WalletSetting");
      const [found] = await db.select().from(settings).where(eq(settings.id, setting.id));
      return found;
    }

    async function findChecks() {
      const [reload, creditsLow] = await Promise.all([
        findJobRows(WalletBalanceReloadCheck[JOB_NAME], { singletonKey: singletonKeyOf(WalletBalanceReloadCheck[JOB_NAME], target) }),
        findJobRows(WalletCreditsLowCheck[JOB_NAME], { singletonKey: singletonKeyOf(WalletCreditsLowCheck[JOB_NAME], target) })
      ]);
      return { reload: reload.map(({ state }) => state), creditsLow: creditsLow.map(({ state }) => state) };
    }

    return {
      handler: container.resolve(ApplyAccountTerminationHandler),
      db,
      user,
      wallet,
      calls,
      findAll,
      close,
      executeFundingTx,
      run,
      findWallet,
      findWalletSetting,
      findChecks
    };
  }
});
