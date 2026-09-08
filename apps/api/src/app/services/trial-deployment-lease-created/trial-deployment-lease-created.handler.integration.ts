import "@src/app/providers/jobs.provider";

import { addHours } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { TrialDeploymentLeaseCreated } from "@src/billing/events/trial-deployment-lease-created";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { JOB_NAME } from "@src/core";
import { DOMAIN_EVENT_NAME } from "@src/core/services/domain-events/domain-events.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { NotificationHandler, NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { CloseTrialDeployment, CloseTrialDeploymentHandler } from "../close-trial-deployment/close-trial-deployment.handler";
import { TrialDeploymentLeaseCreatedHandler } from "./trial-deployment-lease-created.handler";

import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

const jobWorkers = useJobWorkers(() => [
  container.resolve(TrialDeploymentLeaseCreatedHandler),
  container.resolve(NotificationHandler),
  container.resolve(CloseTrialDeploymentHandler)
]);

describe(TrialDeploymentLeaseCreatedHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("schedules the close for the end of the trial deployment's life", async () => {
    const { walletId, dseq, leaseCreatedAt, lifetimeHours, leaseCreated, findCloseJob } = await setup();

    await leaseCreated();

    expect(await findCloseJob()).toMatchObject({
      singleton_key: `closeTrialDeployment.${dseq}.${walletId}`,
      startAfter: addHours(leaseCreatedAt, lifetimeHours)
    });
  });

  it("warns the owner an hour before that close", async () => {
    const { walletId, dseq, leaseCreatedAt, lifetimeHours, leaseCreated, findWarningJob } = await setup();

    await leaseCreated();

    expect(await findWarningJob()).toMatchObject({
      singleton_key: `notification.beforeCloseTrialDeployment.${dseq}.${walletId}`,
      startAfter: addHours(leaseCreatedAt, lifetimeHours - 1)
    });
  });

  it("congratulates the owner on a first lease straight away", async () => {
    const { leaseCreated, awaitCongratulations, sentNotifications } = await setup({ isFirstLease: true });

    await leaseCreated();
    await awaitCongratulations();

    expect(sentNotifications()).toHaveLength(1);
  });

  it("says nothing about a lease that is not the first", async () => {
    const { leaseCreated, findCongratulationJobs } = await setup({ isFirstLease: false });

    await leaseCreated();

    expect(await findCongratulationJobs()).toHaveLength(0);
  });

  it("schedules nothing for a wallet that has left the trial", async () => {
    const { leaseCreated, findCloseJob, findWarningJob } = await setup({ isTrialing: false });

    await leaseCreated();

    expect(await findCloseJob()).toBeUndefined();
    expect(await findWarningJob()).toBeUndefined();
  });

  it("schedules nothing for a wallet with no address to close against", async () => {
    const { leaseCreated, findCloseJob, findWarningJob } = await setup({ address: null });

    await leaseCreated();

    expect(await findCloseJob()).toBeUndefined();
    expect(await findWarningJob()).toBeUndefined();
  });

  async function setup(input: { isTrialing?: boolean; isFirstLease?: boolean; address?: string | null } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const lifetimeHours = container.resolve(BillingConfigService).get("TRIAL_DEPLOYMENT_CLEANUP_HOURS");
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;

    const { wallet } = await seedUserWithWallet({
      isTrialing: input.isTrialing ?? true,
      ...(input.address === null ? { address: null } : {}),
      user: { email: "trial-lease@example.com" }
    });
    const dseq = createDseq();
    const leaseCreatedAt = new Date();

    const sent: unknown[] = [];
    nock(notificationsBaseUrl)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
        sent.push(body);

        return [204];
      });

    async function findJobBySingletonKey(jobName: string, singletonKey: string) {
      const [row] = await findJobRows(jobName, { singletonKey });

      return row && { singleton_key: row.singleton_key, startAfter: new Date(row.start_after) };
    }

    return {
      walletId: wallet.id,
      dseq,
      leaseCreatedAt,
      lifetimeHours,
      sentNotifications: () => sent,
      findCloseJob: () => findJobBySingletonKey(CloseTrialDeployment[JOB_NAME], `closeTrialDeployment.${dseq}.${wallet.id}`),
      findWarningJob: () => findJobBySingletonKey(NotificationJob[JOB_NAME], `notification.beforeCloseTrialDeployment.${dseq}.${wallet.id}`),
      awaitCongratulations: () => expectJobCompleted(NotificationJob[JOB_NAME], { singletonKey: `notification.trialFirstDeploymentLeaseCreated.${wallet.id}` }),
      findCongratulationJobs: () => findJobRows(NotificationJob[JOB_NAME], { singletonKey: `notification.trialFirstDeploymentLeaseCreated.${wallet.id}` }),
      leaseCreated: async () => {
        await enqueue(
          new TrialDeploymentLeaseCreated({
            walletId: wallet.id,
            dseq,
            createdAt: leaseCreatedAt.toISOString(),
            isFirstLease: input.isFirstLease ?? false
          })
        );
        await startWorkers();
        await expectJobCompleted(TrialDeploymentLeaseCreated[DOMAIN_EVENT_NAME], { data: { dseq } });
      }
    };
  }
});
