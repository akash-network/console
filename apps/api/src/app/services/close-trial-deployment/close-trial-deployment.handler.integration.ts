import "@src/app/providers/jobs.provider";

import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { minutesToMilliseconds } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { JOB_NAME } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { NotificationHandler, NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { CloseTrialDeployment, CloseTrialDeploymentHandler, closeTrialDeploymentKeyFor } from "./close-trial-deployment.handler";

import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";
import { interceptNotifications } from "@test/services/notifications-intercept";

const UNSETTLEABLE_ESCROW = "negative decimal coin amount";
const RETRY_DELAY_IN_MS = minutesToMilliseconds(15);

const jobWorkers = useJobWorkers(() => [container.resolve(CloseTrialDeploymentHandler), container.resolve(NotificationHandler)]);

describe(CloseTrialDeploymentHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("closes an active trial deployment and tells the owner", async () => {
    const { walletId, dseq, closeTrialDeployment, awaitClosedNotice, close, sentNotifications } = await setup();

    await closeTrialDeployment();
    await awaitClosedNotice();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: walletId }), dseq, { reason: "trial_ended" });
    expect(sentNotifications()).toHaveLength(1);
  });

  it("records the close in the owner's feed as Console's, because the trial ended", async () => {
    const { dseq, address, closeTrialDeployment, findActivities } = await setup();

    await closeTrialDeployment();

    expect(await findActivities()).toEqual([
      expect.objectContaining({
        type: "deployment_close",
        status: "succeeded",
        initiator: "system",
        meta: { dseq, reason: "trial_ended" },
        dedupeKey: deploymentCloseDedupeKeyOf({ owner: address, dseq })
      })
    ]);
  });

  it("adds nothing to the feed when the deployment had already closed", async () => {
    const { closeTrialDeployment, close, findActivities } = await setup();
    close.mockResolvedValue(false);

    await closeTrialDeployment();

    expect(await findActivities()).toEqual([]);
  });

  it("leaves a wallet that has left the trial alone", async () => {
    const { closeTrialDeployment, close, findClosedNotice } = await setup({ isTrialing: false });

    await closeTrialDeployment();

    expect(close).not.toHaveBeenCalled();
    expect(await findClosedNotice()).toBeUndefined();
  });

  it("leaves a wallet with no address alone", async () => {
    const { closeTrialDeployment, close } = await setup({ address: null });

    await closeTrialDeployment();

    expect(close).not.toHaveBeenCalled();
  });

  it("leaves a deployment the chain no longer reports as active alone", async () => {
    const { closeTrialDeployment, close } = await setup({ deploymentState: "closed" });

    await closeTrialDeployment();

    expect(close).not.toHaveBeenCalled();
  });

  it("tells the owner nothing and records nothing yet when the escrow cannot be settled", async () => {
    const { closeTrialDeployment, close, findClosedNotice, findActivities } = await setup();
    close.mockRejectedValue(new Error(`failed to execute message: ${UNSETTLEABLE_ESCROW}`));

    await closeTrialDeployment();

    expect(await findClosedNotice()).toBeUndefined();
    expect(await findActivities()).toEqual([]);
  });

  it("tries again later when the escrow cannot be settled yet, so the trial close still happens", async () => {
    const { closeTrialDeployment, close, findRetry } = await setup();
    close.mockRejectedValue(new Error(`failed to execute message: ${UNSETTLEABLE_ESCROW}`));

    await closeTrialDeployment();

    expect(Date.parse((await findRetry()).start_after)).toBeGreaterThan(Date.now() + RETRY_DELAY_IN_MS * 0.8);
  });

  async function setup(input: { isTrialing?: boolean; address?: string | null; deploymentState?: string } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const { wallet } = await seedUserWithWallet({
      isTrialing: input.isTrialing ?? true,
      ...(input.address === null ? { address: null } : {}),
      user: { email: "close-trial@example.com" }
    });
    const dseq = createDseq();
    const closedNoticeKey = `notification.trialDeploymentClosed.${dseq}.${wallet.id}`;
    const closeKey = closeTrialDeploymentKeyFor({ dseq, walletId: wallet.id });

    vi.spyOn(container.resolve(DeploymentHttpService), "findByOwnerAndDseq").mockResolvedValue(
      createDeploymentInfoSeed({ owner: wallet.address ?? undefined, dseq, state: input.deploymentState ?? "active" })
    );

    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockResolvedValue(true);
    const sentNotifications = interceptNotifications();

    return {
      walletId: wallet.id,
      address: wallet.address as string,
      dseq,
      close,
      sentNotifications,
      findActivities: () => container.resolve(ActivityRepository).find({ userId: wallet.userId }),
      findRetry: async () => {
        const [row] = await findJobRows(CloseTrialDeployment[JOB_NAME], { singletonKey: closeKey, state: "created" });

        return row;
      },
      awaitClosedNotice: () => expectJobCompleted(NotificationJob[JOB_NAME], { singletonKey: closedNoticeKey }),
      findClosedNotice: async () => {
        const [row] = await findJobRows(NotificationJob[JOB_NAME], { singletonKey: closedNoticeKey });

        return row;
      },
      closeTrialDeployment: async () => {
        await enqueue(new CloseTrialDeployment({ walletId: wallet.id, dseq }), { singletonKey: closeKey });
        await startWorkers();
        await expectJobCompleted(CloseTrialDeployment[JOB_NAME], { singletonKey: closeKey, state: "completed" });
      }
    };
  }
});
