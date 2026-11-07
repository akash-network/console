import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import { addDays, addHours, subHours } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";

import { ManagedDeploymentLeaseCreated } from "@src/billing/events/managed-deployment-lease-created";
import { GpuWinBackCheckHandler } from "@src/billing/services/gpu-win-back/gpu-win-back-check.handler";
import { GpuWinBackCheck, gpuWinBackCheckKeyFor } from "@src/billing/services/gpu-win-back/gpu-win-back-check.job";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CheckTemplateDeploymentStillRunningHandler } from "@src/template-marketplace/services/check-template-deployment-still-running/check-template-deployment-still-running.handler";
import {
  CheckTemplateDeploymentStillRunning,
  checkTemplateDeploymentStillRunningKeyFor
} from "@src/template-marketplace/services/check-template-deployment-still-running/check-template-deployment-still-running.job";
import { ManagedDeploymentLeaseCreatedHandler } from "./managed-deployment-lease-created.handler";

import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const LEASE_CREATED_EVENT = ManagedDeploymentLeaseCreated[JOB_NAME];
const CHECK_JOB = GpuWinBackCheck[JOB_NAME];
const STILL_RUNNING_CHECK_JOB = CheckTemplateDeploymentStillRunning[JOB_NAME];

const jobWorkers = useJobWorkers(() => [
  container.resolve(ManagedDeploymentLeaseCreatedHandler),
  container.resolve(GpuWinBackCheckHandler),
  container.resolve(CheckTemplateDeploymentStillRunningHandler)
]);

describe(ManagedDeploymentLeaseCreatedHandler.name, () => {
  it("refuses a second gpu read request for the same deployment while the first is still queued", async () => {
    const { announceForLater } = await setup();

    const first = await announceForLater();
    const second = await announceForLater();

    expect(first).toEqual(expect.any(String));
    expect(second).toBeNull();
  });

  it("queues the gpu win-back check of a personal wallet's owner a week after the lease was created", async () => {
    const { announceNow } = await setup();
    const { user, wallet } = await seedUserWithWallet();
    const leaseCreatedAt = new Date();

    await announceNow(wallet.id, leaseCreatedAt);

    const checks = await findJobRows(CHECK_JOB, { singletonKey: gpuWinBackCheckKeyFor(user.id) });
    expect(checks.map(({ state, data, start_after }) => ({ state, data, startAfter: new Date(start_after) }))).toEqual([
      { state: "created", data: { userId: user.id, version: 1 }, startAfter: addDays(leaseCreatedAt, 7) }
    ]);
  });

  it("queues no gpu win-back check for a lease of a team wallet", async () => {
    const { announceNow } = await setup();
    const { organization: team } = await seedOrganizationWithOwner();
    const wallet = await seedOrganizationWallet({ organizationId: team.id });
    const checksBefore = await findJobRows(CHECK_JOB);

    await announceNow(wallet.id, new Date());

    expect(await findJobRows(CHECK_JOB)).toHaveLength(checksBefore.length);
  });

  it("records template usage once when the lease is followed up twice", async () => {
    const { followUpLease } = await setup();
    const { user, wallet } = await seedUserWithWallet();
    const setting = await seedDeploymentSetting({ userId: user.id, templateId: "hello-world" });
    const leaseCreatedAt = subHours(new Date(), 3);

    await followUpLease({ walletId: wallet.id, dseq: setting.dseq, createdAt: leaseCreatedAt, times: 2 });

    expect(await findTemplateEventsOf(setting.id)).toEqual([
      expect.objectContaining({ action: "lease_created", templateRef: "hello-world", createdAt: leaseCreatedAt })
    ]);
    const checks = await findJobRows(STILL_RUNNING_CHECK_JOB, { singletonKey: checkTemplateDeploymentStillRunningKeyFor(setting.id) });
    expect(checks.map(({ state, start_after }) => ({ state, startAfter: new Date(start_after) }))).toEqual([
      { state: "created", startAfter: addHours(leaseCreatedAt, 24) }
    ]);
  });

  async function findTemplateEventsOf(deploymentSettingId: string) {
    const events = resolveTable("TemplateUsageEvents");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(events).where(eq(events.deploymentSettingId, deploymentSettingId));
  }

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const walletId = faker.number.int({ min: 1, max: 1_000_000 });
    const dseq = createDseq();

    async function announceNow(leaseWalletId: number, createdAt: Date) {
      const leaseDseq = createDseq();
      await enqueue(new ManagedDeploymentLeaseCreated({ walletId: leaseWalletId, dseq: leaseDseq, createdAt: createdAt.toISOString() }), {
        singletonKey: `${ManagedDeploymentLeaseCreated.name}.${leaseDseq}.${leaseWalletId}`
      });
      await startWorkers();
      await expectJobCompleted(LEASE_CREATED_EVENT, { data: { dseq: leaseDseq } });
    }

    async function followUpLease(lease: { walletId: number; dseq: string; createdAt: Date; times: number }) {
      await startWorkers();

      for (let followUp = 1; followUp <= lease.times; followUp++) {
        await enqueue(new ManagedDeploymentLeaseCreated({ walletId: lease.walletId, dseq: lease.dseq, createdAt: lease.createdAt.toISOString() }), {
          singletonKey: `${ManagedDeploymentLeaseCreated.name}.${lease.dseq}.${lease.walletId}`
        });
        await vi.waitFor(
          async () => {
            const states = (await findJobRows(LEASE_CREATED_EVENT, { data: { dseq: lease.dseq } })).map(({ state }) => state);
            expect(states).toEqual(Array(followUp).fill("completed"));
          },
          { timeout: 20_000, interval: 250 }
        );
      }
    }

    return {
      announceNow,
      followUpLease,
      announceForLater: () =>
        enqueue(new ManagedDeploymentLeaseCreated({ walletId, dseq, createdAt: new Date().toISOString() }), {
          singletonKey: `${ManagedDeploymentLeaseCreated.name}.${dseq}.${walletId}`,
          startAfter: addHours(new Date(), 1).toISOString()
        })
    };
  }
});
