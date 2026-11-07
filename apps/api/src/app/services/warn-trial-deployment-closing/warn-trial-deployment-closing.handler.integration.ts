import "@src/app/providers/jobs.provider";

import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { addHours } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { NotificationHandler, NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { WarnTrialDeploymentClosing, WarnTrialDeploymentClosingHandler } from "./warn-trial-deployment-closing.handler";

import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";
import { interceptNotifications } from "@test/services/notifications-intercept";

const jobWorkers = useJobWorkers(() => [container.resolve(WarnTrialDeploymentClosingHandler), container.resolve(NotificationHandler)]);

describe(WarnTrialDeploymentClosingHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("warns the owner of a trial deployment that is still running", async () => {
    const { userId, warn, awaitWarning, sentNotifications } = await setup();

    await warn();
    await awaitWarning();

    expect(sentNotifications()).toHaveLength(1);
    expect(sentNotifications()[0]).toMatchObject({ userId, body: { payload: { summary: "Your Trial Deployment Ends Soon" } } });
  });

  it("says nothing about a trial deployment the owner already closed", async () => {
    const { warn, findWarnings } = await setup({ deploymentState: "closed" });

    await warn();

    expect(await findWarnings()).toEqual([]);
  });

  it("says nothing to a wallet that has left the trial", async () => {
    const { warn, findWarnings } = await setup({ isTrialing: false });

    await warn();

    expect(await findWarnings()).toEqual([]);
  });

  async function setup(input: { isTrialing?: boolean; deploymentState?: string } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user, wallet } = await seedUserWithWallet({ isTrialing: input.isTrialing ?? true, user: { email: "warn-trial-close@example.com" } });
    const dseq = createDseq();
    const warningKey = `warnTrialDeploymentClosing.${dseq}.${wallet.id}`;
    const notificationKey = `notification.beforeCloseTrialDeployment.${dseq}.${wallet.id}`;

    vi.spyOn(container.resolve(DeploymentHttpService), "findByOwnerAndDseq").mockResolvedValue(
      createDeploymentInfoSeed({ owner: wallet.address ?? undefined, dseq, state: input.deploymentState ?? "active" })
    );
    const sentNotifications = interceptNotifications();

    return {
      userId: user.id,
      sentNotifications,
      awaitWarning: () => expectJobCompleted(NotificationJob[JOB_NAME], { singletonKey: notificationKey }),
      findWarnings: () => findJobRows(NotificationJob[JOB_NAME], { singletonKey: notificationKey }),
      warn: async () => {
        await enqueue(new WarnTrialDeploymentClosing({ walletId: wallet.id, dseq, closesAt: addHours(new Date(), 1).toISOString() }), {
          singletonKey: warningKey
        });
        await startWorkers();
        await expectJobCompleted(WarnTrialDeploymentClosing[JOB_NAME], { singletonKey: warningKey, state: "completed" });
      }
    };
  }
});
