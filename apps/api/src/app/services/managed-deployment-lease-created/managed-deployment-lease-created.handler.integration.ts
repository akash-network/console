import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import { addHours } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ManagedDeploymentLeaseCreated } from "@src/billing/events/managed-deployment-lease-created";
import { ManagedDeploymentLeaseCreatedHandler } from "./managed-deployment-lease-created.handler";

import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ManagedDeploymentLeaseCreatedHandler)]);

describe(ManagedDeploymentLeaseCreatedHandler.name, () => {
  it("refuses a second gpu read request for the same deployment while the first is still queued", async () => {
    const { announceForLater } = await setup();

    const first = await announceForLater();
    const second = await announceForLater();

    expect(first).toEqual(expect.any(String));
    expect(second).toBeNull();
  });

  async function setup() {
    const { enqueue } = await jobWorkers();
    const walletId = faker.number.int({ min: 1, max: 1_000_000 });
    const dseq = createDseq();

    return {
      announceForLater: () =>
        enqueue(new ManagedDeploymentLeaseCreated({ walletId, dseq, createdAt: new Date().toISOString() }), {
          singletonKey: `${ManagedDeploymentLeaseCreated.name}.${dseq}.${walletId}`,
          startAfter: addHours(new Date(), 1).toISOString()
        })
    };
  }
});
