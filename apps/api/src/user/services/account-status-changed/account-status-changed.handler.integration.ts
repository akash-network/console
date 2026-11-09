import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import type { AccountStatus } from "@src/user/lib/account-status/account-status";
import type { AccountStatusEventInput } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { CloseAccountDeploymentsHandler } from "@src/user/services/close-account-deployments/close-account-deployments.handler";
import {
  CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS,
  CloseAccountDeployments,
  closeAccountDeploymentsKeyFor
} from "@src/user/services/close-account-deployments/close-account-deployments.job";
import { AccountStatusChangedHandler } from "./account-status-changed.handler";
import { AccountStatusChanged, accountStatusChangedKeyFor } from "./account-status-changed.job";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(AccountStatusChangedHandler), container.resolve(CloseAccountDeploymentsHandler)]);

describe(AccountStatusChangedHandler.name, () => {
  it("queues closing the deployments of a suspension that asked for it, run the way a worker runs it", async () => {
    const { user, record, enqueue, startWorkers } = await setup({ accountStatus: "suspended" });
    const event = await record({ action: "suspend", userReason: "Abuse", options: { closeDeployments: true } });

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

  it("leaves the deployments of a suspension that kept them alone", async () => {
    const { handler, user, record } = await setup({ accountStatus: "suspended" });
    const event = await record({ action: "suspend", userReason: "Abuse", options: { closeDeployments: false } });

    await handler.handle({ eventId: event.id, version: 1 });

    expect(await findJobRows(CloseAccountDeployments[JOB_NAME], { singletonKey: closeAccountDeploymentsKeyFor(user.id) })).toEqual([]);
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

  async function setup(input: { accountStatus: AccountStatus }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const user = await seedUser({ email: faker.internet.email(), accountStatus: input.accountStatus });

    async function record(event: Pick<AccountStatusEventInput, "action" | "userReason" | "options">) {
      return await container.resolve(AccountStatusEventRepository).create({
        userId: user.id,
        userEmail: user.email,
        actorEmail: faker.internet.email(),
        actorName: faker.person.fullName(),
        ...event
      });
    }

    return { handler: container.resolve(AccountStatusChangedHandler), db, user, record, enqueue, startWorkers };
  }
});
