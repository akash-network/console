import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { WalletBalanceReloadCheckHandler } from "@src/billing/services/wallet-balance-reload-check/wallet-balance-reload-check.handler";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import type { AccountStatus } from "@src/user/lib/account-status/account-status";
import type { AccountStatusEventInput } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { ApplyAccountTerminationHandler } from "@src/user/services/apply-account-termination/apply-account-termination.handler";
import { ApplyAccountTermination, applyAccountTerminationKeyFor } from "@src/user/services/apply-account-termination/apply-account-termination.job";
import { CloseAccountDeploymentsHandler } from "@src/user/services/close-account-deployments/close-account-deployments.handler";
import {
  CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS,
  CloseAccountDeployments,
  closeAccountDeploymentsKeyFor
} from "@src/user/services/close-account-deployments/close-account-deployments.job";
import { AccountStatusChangedHandler } from "./account-status-changed.handler";
import { AccountStatusChanged, accountStatusChangedKeyFor } from "./account-status-changed.job";

import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { deleteQueuedJobs, expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [
  container.resolve(AccountStatusChangedHandler),
  container.resolve(CloseAccountDeploymentsHandler),
  container.resolve(ApplyAccountTerminationHandler),
  container.resolve(WalletBalanceReloadCheckHandler)
]);

describe(AccountStatusChangedHandler.name, () => {
  it("leaves the deployments of a suspension that kept them alone", async () => {
    const { handler, user, record } = await setup({ accountStatus: "suspended" });
    const event = await record({ action: "suspend", userReason: "Abuse", options: { closeDeployments: false } });

    await handler.handle({ eventId: event.id, version: 1 });

    expect(await findJobRows(CloseAccountDeployments[JOB_NAME], { singletonKey: closeAccountDeploymentsKeyFor(user.id) })).toEqual([]);
  });

  it("queues the termination effects with the admin's credit choice", async () => {
    const { handler, user, record } = await setup({ accountStatus: "terminated" });
    const event = await record({ action: "terminate", userReason: "Fraud", options: { forfeitCredits: true, emailVerified: true } });

    await handler.handle({ eventId: event.id, version: 1 });

    expect(await findJobRows(ApplyAccountTermination[JOB_NAME], { singletonKey: applyAccountTerminationKeyFor(user.id) })).toEqual([
      expect.objectContaining({ state: "created", data: { userId: user.id, forfeitCredits: true, version: 1 } })
    ]);
  });

  it("queues the next auto-recharge check of a reinstated user whose own wallet has auto-recharge on", async () => {
    const { handler, recordFor } = await setup({ accountStatus: "active" });
    const { user, wallet } = await seedUserWithWallet();
    await seedWalletSetting({ userId: user.id, walletId: wallet.id, autoReloadEnabled: true, autoReloadThreshold: 1500 });
    const event = await recordFor(user, { action: "reinstate", userReason: null, options: {} });

    await handler.handle({ eventId: event.id, version: 1 });

    expect(await findJobRows(WalletBalanceReloadCheck[JOB_NAME], { singletonKey: `${WalletBalanceReloadCheck[JOB_NAME]}.${user.id}` })).toEqual([
      expect.objectContaining({ state: "created", data: { userId: user.id, version: 1 } })
    ]);
  });

  it("queues no auto-recharge check for a reinstated user whose auto-recharge is off", async () => {
    const { handler, recordFor } = await setup({ accountStatus: "active" });
    const { user, wallet } = await seedUserWithWallet();
    await seedWalletSetting({ userId: user.id, walletId: wallet.id, autoReloadEnabled: false });
    const event = await recordFor(user, { action: "reinstate", userReason: null, options: {} });

    await handler.handle({ eventId: event.id, version: 1 });

    expect(await findJobRows(WalletBalanceReloadCheck[JOB_NAME], { singletonKey: `${WalletBalanceReloadCheck[JOB_NAME]}.${user.id}` })).toEqual([]);
  });

  it("queues nothing for an event whose user was deleted since", async () => {
    const { handler, db, user, record } = await setup({ accountStatus: "suspended" });
    const event = await record({ action: "suspend", userReason: "Abuse", options: { closeDeployments: true } });
    await db.delete(resolveTable("Users")).where(eq(resolveTable("Users").id, user.id));

    await handler.handle({ eventId: event.id, version: 1 });

    expect(await findJobRows(CloseAccountDeployments[JOB_NAME], { singletonKey: closeAccountDeploymentsKeyFor(user.id) })).toEqual([]);
  });

  it("does nothing for an event that does not exist", async () => {
    const { handler } = await setup({ accountStatus: "active" });

    await expect(handler.handle({ eventId: faker.string.uuid(), version: 1 })).resolves.toBeUndefined();
  });

  it("queues closing the deployments of a suspension that asked for it, run the way a worker runs it", async () => {
    const { user, record, enqueue, startWorkers } = await setup({ accountStatus: "suspended" });
    const event = await record({ action: "suspend", userReason: "Abuse", options: { closeDeployments: true } });
    await deleteQueuedJobs(ApplyAccountTermination[JOB_NAME]);
    await deleteQueuedJobs(WalletBalanceReloadCheck[JOB_NAME]);

    await enqueue(new AccountStatusChanged({ eventId: event.id }), { singletonKey: accountStatusChangedKeyFor(event.id) });
    await startWorkers();

    await expectJobCompleted(AccountStatusChanged[JOB_NAME], { singletonKey: accountStatusChangedKeyFor(event.id) });
    const [closeJob] = await findJobRows(CloseAccountDeployments[JOB_NAME], { singletonKey: closeAccountDeploymentsKeyFor(user.id) });
    expect(closeJob).toMatchObject({
      data: { userId: user.id, version: 1 },
      retry_limit: CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS.retryLimit,
      retry_delay: CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS.retryDelay,
      retry_delay_max: CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS.retryDelayMax
    });
  });

  async function setup(input: { accountStatus: AccountStatus }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const user = await seedUser({ email: faker.internet.email(), accountStatus: input.accountStatus });

    async function recordFor(owner: { id: string; email: string | null }, event: Pick<AccountStatusEventInput, "action" | "userReason" | "options">) {
      return await container.resolve(AccountStatusEventRepository).create({
        userId: owner.id,
        userEmail: owner.email,
        actorEmail: faker.internet.email(),
        actorName: faker.person.fullName(),
        ...event
      });
    }

    async function record(event: Pick<AccountStatusEventInput, "action" | "userReason" | "options">) {
      return await recordFor(user, event);
    }

    return { handler: container.resolve(AccountStatusChangedHandler), db, user, record, recordFor, enqueue, startWorkers };
  }
});
