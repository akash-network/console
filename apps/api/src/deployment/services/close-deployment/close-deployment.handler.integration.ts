import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { type ApiPgDatabase, type EnqueueOptions, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { pendingCloseActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { CloseDeploymentHandler } from "./close-deployment.handler";
import { CLOSE_DEPLOYMENT_RETRY_OPTIONS, CloseDeployment, closeDeploymentKeyFor } from "./close-deployment.job";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(CloseDeploymentHandler)]);

describe(CloseDeploymentHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes the deployment with the user's wallet and records the close as succeeded, run the way a worker runs it", async () => {
    const { wallet, dseq, close, closeInBackground, findActivity } = await setup();

    await closeInBackground();

    await expectJobCompleted(CloseDeployment[JOB_NAME], { singletonKey: closeDeploymentKeyFor({ userId: wallet.userId, dseq }) });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id, address: wallet.address }), dseq, { actingUserId: wallet.userId });
    expect(await findActivity()).toMatchObject({ status: "succeeded", meta: { dseq } });
  });

  it("settles the close of a team deployment under the organization wallet's key the request opened it with", async () => {
    const { owner, dseq, close, closeInBackground, findActivity, awaitCompleted } = await setup({ inTeam: true });

    await closeInBackground();

    await awaitCompleted();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ userId: null, address: owner }), dseq, { actingUserId: expect.any(String) });
    expect(await findActivity()).toMatchObject({ status: "succeeded", dedupeKey: deploymentCloseDedupeKeyOf({ owner, dseq }) });
  });

  it("keeps the bulk close the close was part of in the activity it settles", async () => {
    const { wallet, dseq, closeInBackground, findActivity } = await setup({ batchId: "b47c4a2e-5f0d-4c1e-9a7b-2d3e4f5a6b7c" });

    await closeInBackground();

    await expectJobCompleted(CloseDeployment[JOB_NAME], { singletonKey: closeDeploymentKeyFor({ userId: wallet.userId, dseq }) });
    expect(await findActivity()).toMatchObject({ status: "succeeded", meta: { dseq, batchId: "b47c4a2e-5f0d-4c1e-9a7b-2d3e4f5a6b7c" } });
  });

  it("records the close as failed with its reason once the last attempt fails", async () => {
    const { close, closeInBackground, findActivity, waitForJobIn } = await setup();
    close.mockRejectedValue(createError(400, "Deployment is not open"));

    await closeInBackground({ retryLimit: 0 });

    await waitForJobIn("failed");
    expect(await findActivity()).toMatchObject({ status: "failed", meta: { error: { code: "close_failed", message: "Deployment is not open" } } });
  });

  it("keeps the activity pending while the close still has retries to come", async () => {
    const { close, closeInBackground, findActivity, waitForJobIn } = await setup();
    close.mockRejectedValue(new Error("node unreachable"));

    await closeInBackground({ retryLimit: 3, retryDelay: 3600 });

    await waitForJobIn("retry");
    expect(await findActivity()).toMatchObject({ status: "pending" });
  });

  async function setup(input: { batchId?: string; inTeam?: boolean } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const { wallet } = await seedUserWithWallet();
    const teamWallet = input.inTeam ? await seedTeamWalletFor(wallet.userId) : undefined;
    const owner = (teamWallet ?? wallet).address as string;
    const dseq = faker.string.numeric(7);
    const activity = await activityRepository.create(pendingCloseActivityOf({ userId: wallet.userId, owner, dseq, batchId: input.batchId }));
    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockResolvedValue(true);
    const singletonKey = closeDeploymentKeyFor({ userId: wallet.userId, dseq });

    return {
      wallet,
      owner,
      dseq,
      close,
      awaitCompleted: () => expectJobCompleted(CloseDeployment[JOB_NAME], { singletonKey }),
      closeInBackground: async (retryOverrides: EnqueueOptions = {}) => {
        await enqueue(new CloseDeployment({ userId: wallet.userId, dseq, activityId: activity.id, batchId: input.batchId, walletId: teamWallet?.id }), {
          singletonKey,
          ...CLOSE_DEPLOYMENT_RETRY_OPTIONS,
          ...retryOverrides
        });
        await startWorkers();
      },
      findActivity: async () => await activityRepository.findById(activity.id),
      waitForJobIn: async (state: "failed" | "retry") =>
        await vi.waitFor(
          async () => {
            const [row] = await findJobRows(CloseDeployment[JOB_NAME], { singletonKey });
            expect(row?.state).toBe(state);
          },
          { timeout: 15_000, interval: 100 }
        )
    };
  }

  async function seedTeamWalletFor(memberId: string) {
    const { organization } = await seedOrganizationWithOwner();
    await seedOrganizationMember({ organizationId: organization.id, userId: memberId });
    const [wallet] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId: organization.id, address: createAkashAddress(), isTrialing: false })
      .returning();

    return wallet;
  }
});
