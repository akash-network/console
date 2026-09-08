import "@src/app/providers/jobs.provider";

import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { NotificationHandler, NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { CloseTrialDeployment, CloseTrialDeploymentHandler } from "./close-trial-deployment.handler";

import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";
import { interceptNotifications } from "@test/services/notifications-intercept";

const UNSETTLEABLE_ESCROW = "negative decimal coin amount";

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

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: walletId }), dseq);
    expect(sentNotifications()).toHaveLength(1);
  });

  it("leaves a wallet that has left the trial alone", async () => {
    const { closeTrialDeployment, close, sentNotifications } = await setup({ isTrialing: false });

    await closeTrialDeployment();

    expect(close).not.toHaveBeenCalled();
    expect(sentNotifications()).toHaveLength(0);
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

  it("tells the owner nothing when the escrow cannot be settled yet", async () => {
    const { closeTrialDeployment, close, findClosedNotice } = await setup();
    close.mockRejectedValue(new Error(`failed to execute message: ${UNSETTLEABLE_ESCROW}`));

    await closeTrialDeployment();

    expect(await findClosedNotice()).toBeUndefined();
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

    vi.spyOn(container.resolve(DeploymentHttpService), "findByOwnerAndDseq").mockResolvedValue(
      createDeploymentInfoSeed({ owner: wallet.address ?? undefined, dseq, state: input.deploymentState ?? "active" })
    );

    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockResolvedValue(true);
    const sentNotifications = interceptNotifications();

    return {
      walletId: wallet.id,
      dseq,
      close,
      sentNotifications,
      awaitClosedNotice: () => expectJobCompleted(NotificationJob[JOB_NAME], { singletonKey: closedNoticeKey }),
      findClosedNotice: async () => {
        const [row] = await findJobRows(NotificationJob[JOB_NAME], { singletonKey: closedNoticeKey });

        return row;
      },
      closeTrialDeployment: async () => {
        await enqueue(new CloseTrialDeployment({ walletId: wallet.id, dseq }), { singletonKey: `closeTrialDeployment.${dseq}.${wallet.id}` });
        await startWorkers();
        await expectJobCompleted(CloseTrialDeployment[JOB_NAME], { singletonKey: `closeTrialDeployment.${dseq}.${wallet.id}` });
      }
    };
  }
});
