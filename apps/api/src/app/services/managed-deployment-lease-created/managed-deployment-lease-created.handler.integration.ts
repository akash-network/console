import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import { addDays, addHours } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ManagedDeploymentLeaseCreated } from "@src/billing/events/managed-deployment-lease-created";
import { GpuWinBackCheckHandler } from "@src/billing/services/gpu-win-back/gpu-win-back-check.handler";
import { GpuWinBackCheck, gpuWinBackCheckKeyFor } from "@src/billing/services/gpu-win-back/gpu-win-back-check.job";
import { JOB_NAME } from "@src/core";
import { ManagedDeploymentLeaseCreatedHandler } from "./managed-deployment-lease-created.handler";

import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const LEASE_CREATED_EVENT = ManagedDeploymentLeaseCreated[JOB_NAME];
const CHECK_JOB = GpuWinBackCheck[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(ManagedDeploymentLeaseCreatedHandler), container.resolve(GpuWinBackCheckHandler)]);

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

    return {
      announceNow,
      announceForLater: () =>
        enqueue(new ManagedDeploymentLeaseCreated({ walletId, dseq, createdAt: new Date().toISOString() }), {
          singletonKey: `${ManagedDeploymentLeaseCreated.name}.${dseq}.${walletId}`,
          startAfter: addHours(new Date(), 1).toISOString()
        })
    };
  }
});
