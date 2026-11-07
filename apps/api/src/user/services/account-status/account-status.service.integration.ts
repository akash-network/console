import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CloseAccountDeploymentsHandler } from "@src/user/services/close-account-deployments/close-account-deployments.handler";
import { CloseAccountDeployments, closeAccountDeploymentsKeyFor } from "@src/user/services/close-account-deployments/close-account-deployments.job";
import { AccountStatusService } from "./account-status.service";

import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(CloseAccountDeploymentsHandler)]);

describe(AccountStatusService.name, () => {
  it("suspends an active user and records the event", async () => {
    const { service, actor, findUser, findEvents } = await setup();
    const { user } = await seedUserWithWallet({ user: { email: faker.internet.email() } });

    const event = await service.suspend(user.id, { actor, userReason: "Unpaid invoices", internalNote: "Chargeback on card", closeDeployments: false });

    expect((await findUser(user.id))?.accountStatus).toBe("suspended");
    expect(await findEvents(user.id)).toEqual([
      expect.objectContaining({
        id: event.id,
        userId: user.id,
        userEmail: user.email,
        action: "suspend",
        actorStaffId: actor.staffId,
        actorEmail: actor.email,
        actorName: actor.name,
        userReason: "Unpaid invoices",
        internalNote: "Chargeback on card",
        options: { closeDeployments: false },
        notificationSentAt: null
      })
    ]);
  });

  it("rejects suspending a suspended user with 409 account_status_conflict", async () => {
    const { service, actor, findUser, findEvents } = await setup();
    const user = await seedUser({ accountStatus: "suspended" });

    await expect(service.suspend(user.id, { actor, userReason: "Again", closeDeployments: true })).rejects.toMatchObject({
      status: 409,
      errorCode: "account_status_conflict"
    });

    expect((await findUser(user.id))?.accountStatus).toBe("suspended");
    expect(await findEvents(user.id)).toEqual([]);
    expect(await findJobRows(CloseAccountDeployments[JOB_NAME], { singletonKey: closeAccountDeploymentsKeyFor(user.id) })).toEqual([]);
  });

  it("lets only one of two concurrent suspensions of the same user through", async () => {
    const { service, actor, findEvents } = await setup();
    const user = await seedUser();

    const results = await Promise.allSettled([
      service.suspend(user.id, { actor, userReason: "First", closeDeployments: false }),
      service.suspend(user.id, { actor, userReason: "Second", closeDeployments: false })
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(await findEvents(user.id)).toHaveLength(1);
  });

  it("reinstates a suspended user without changing wallet allowances, api keys or wallet settings", async () => {
    const { service, actor, db, findUser, findEvents, findWallet, findApiKeys, findWalletSettings } = await setup();
    const { user, wallet } = await seedUserWithWallet({ deploymentAllowance: "25000000", feeAllowance: "7000000", isTrialing: false });
    const setting = await seedWalletSetting({ userId: user.id, walletId: wallet.id, autoReloadEnabled: true, autoReloadThreshold: 1500 });
    const [apiKey] = await db
      .insert(resolveTable("ApiKeys"))
      .values({ userId: user.id, hashedKey: faker.string.alphanumeric(64), keyFormat: `ac.sk.test.${faker.string.alphanumeric(15)}`, name: "ci" })
      .returning();
    await service.suspend(user.id, { actor, userReason: "Unpaid invoices", closeDeployments: true });
    const walletBefore = await findWallet(wallet.id);

    const event = await service.reinstate(user.id, { actor, note: "Paid in full" });

    expect((await findUser(user.id))?.accountStatus).toBe("active");
    expect(event).toMatchObject({ action: "reinstate", userReason: null, internalNote: "Paid in full", options: {} });
    expect((await findEvents(user.id)).map(({ action }) => action)).toEqual(["reinstate", "suspend"]);
    expect(await findWallet(wallet.id)).toEqual(walletBefore);
    expect(walletBefore).toMatchObject({ deploymentAllowance: "25000000.00", feeAllowance: "7000000.00" });
    expect(await findApiKeys(user.id)).toEqual([apiKey]);
    expect(await findWalletSettings(user.id)).toEqual([setting]);
    expect(await findJobRows("CreateDeployment")).toEqual([]);
    expect(await findJobRows(CloseAccountDeployments[JOB_NAME], { singletonKey: closeAccountDeploymentsKeyFor(user.id) })).toHaveLength(1);
  });

  it("enqueues CloseAccountDeployments only when closeDeployments is true", async () => {
    const { service, actor } = await setup();
    const closing = await seedUser();
    const keeping = await seedUser();

    await service.suspend(closing.id, { actor, userReason: "Abuse", closeDeployments: true });
    await service.suspend(keeping.id, { actor, userReason: "Abuse", closeDeployments: false });

    expect(await findJobRows(CloseAccountDeployments[JOB_NAME], { singletonKey: closeAccountDeploymentsKeyFor(closing.id) })).toEqual([
      expect.objectContaining({ state: "created", data: { userId: closing.id, version: 1 } })
    ]);
    expect(await findJobRows(CloseAccountDeployments[JOB_NAME], { singletonKey: closeAccountDeploymentsKeyFor(keeping.id) })).toEqual([]);
  });

  it("rejects an unknown user with 404", async () => {
    const { service, actor } = await setup();

    await expect(service.suspend(faker.string.uuid(), { actor, userReason: "Abuse", closeDeployments: true })).rejects.toMatchObject({ status: 404 });
  });

  it("rejects reinstating an active user with 409 account_status_conflict", async () => {
    const { service, actor, findEvents } = await setup();
    const user = await seedUser();

    await expect(service.reinstate(user.id, { actor })).rejects.toMatchObject({ status: 409, errorCode: "account_status_conflict" });

    expect(await findEvents(user.id)).toEqual([]);
  });

  async function setup() {
    await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const service = container.resolve(AccountStatusService);
    const actor = { staffId: faker.string.uuid(), email: faker.internet.email(), name: faker.person.fullName() };
    const users = resolveTable("Users");

    async function findUser(id: string) {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    }

    async function findEvents(userId: string) {
      return await service.findEventsOf(userId);
    }

    async function findWallet(id: number) {
      const wallets = resolveTable("UserWallets");
      const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id));
      return wallet;
    }

    async function findApiKeys(userId: string) {
      const apiKeys = resolveTable("ApiKeys");
      return await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
    }

    async function findWalletSettings(userId: string) {
      const walletSettings = resolveTable("WalletSetting");
      return await db.select().from(walletSettings).where(eq(walletSettings.userId, userId));
    }

    return { service, actor, db, findUser, findEvents, findWallet, findApiKeys, findWalletSettings };
  }
});
