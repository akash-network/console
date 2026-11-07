import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import type { AccountStatus } from "@src/user/lib/account-status/account-status";
import { CloseAccountDeploymentsHandler } from "./close-account-deployments.handler";
import { CloseAccountDeployments, closeAccountDeploymentsKeyFor } from "./close-account-deployments.job";

import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(CloseAccountDeploymentsHandler)]);

describe(CloseAccountDeploymentsHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes every deployment of a suspended user's personal wallet, run the way a worker runs it", async () => {
    const { user, wallet, findAll, close, enqueue, startWorkers } = await setup({ accountStatus: "suspended", openDseqs: ["11", "22"] });

    await enqueue(new CloseAccountDeployments({ userId: user.id }), { singletonKey: closeAccountDeploymentsKeyFor(user.id) });
    await startWorkers();

    await expectJobCompleted(CloseAccountDeployments[JOB_NAME], { singletonKey: closeAccountDeploymentsKeyFor(user.id) });
    expect(findAll).toHaveBeenCalledWith({ owner: wallet.address, state: "active" });
    expect(close).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id, address: wallet.address }), "11", { reason: null });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id, address: wallet.address }), "22", { reason: null });
  });

  it("leaves the deployments of a user reinstated before the job ran alone", async () => {
    const { handler, user, findAll, close } = await setup({ accountStatus: "active", openDseqs: ["11"] });

    await handler.handle({ userId: user.id, version: 1 });

    expect(findAll).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("leaves a team wallet the suspended user owns alone when they have no personal wallet", async () => {
    const { handler, findAll, close } = await setup({ accountStatus: "suspended", openDseqs: ["11"] });
    const { user, organization } = await seedOrganizationWithOwner({ user: { accountStatus: "suspended" } });
    await seedOrganizationWallet({ organizationId: organization.id });

    await handler.handle({ userId: user.id, version: 1 });

    expect(findAll).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("does nothing for a user that no longer exists", async () => {
    const { handler, findAll } = await setup({ accountStatus: "suspended", openDseqs: ["11"] });

    await handler.handle({ userId: faker.string.uuid(), version: 1 });

    expect(findAll).not.toHaveBeenCalled();
  });

  async function setup(input: { accountStatus: AccountStatus; openDseqs: string[] }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user, wallet, address } = await seedUserWithWallet({ user: { accountStatus: input.accountStatus } });
    const findAll = vi.spyOn(container.resolve(DeploymentHttpService), "findAll").mockResolvedValue({
      deployments: input.openDseqs.map(dseq => createDeploymentInfoSeed({ owner: address, dseq })),
      pagination: { next_key: null, total: String(input.openDseqs.length) }
    });
    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockResolvedValue(true);

    return { handler: container.resolve(CloseAccountDeploymentsHandler), user, wallet, findAll, close, enqueue, startWorkers };
  }
});
