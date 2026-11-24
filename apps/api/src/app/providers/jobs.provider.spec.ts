import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { SyncAffiliateCommission } from "@src/affiliate/services/affiliate-commission/sync-affiliate-commission.job";
import { InviteAffiliate } from "@src/affiliate/services/affiliate-invitation/invite-affiliate.job";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { DeleteUnbackedDeploymentSetting } from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { MoveDeploymentAlertsJob } from "@src/deployment/services/move-deployment-alerts/move-deployment-alerts.job";
import { ConfirmGpuPools } from "@src/gpu-waitlist/services/confirm-gpu-pools/confirm-gpu-pools.job";
import { WatchGpuWaitlists } from "@src/gpu-waitlist/services/watch-gpu-waitlists/watch-gpu-waitlists.job";
import { PurgeOrganizationInvitationEmailsJob } from "@src/organization/services/purge-organization-invitation-emails/purge-organization-invitation-emails.job";
import { startJobQueues } from "./jobs.provider";

describe("jobs.provider", () => {
  it("registers bringing the queues up as an app initializer", () => {
    const initializers = container.resolveAll(APP_INITIALIZER);

    expect(initializers.map(initializer => initializer[ON_APP_START])).toContain(startJobQueues);
  });

  it("creates a queue for the compensation a deployment create enqueues", async () => {
    const { jobQueue } = setup();

    await startJobQueues();

    const [handlers] = jobQueue.registerHandlers.mock.calls[0];
    expect(handlers.map(handler => handler.accepts)).toContain(DeleteUnbackedDeploymentSetting);
  });

  it("creates a queue for the purge that recording invitation emails enqueues", async () => {
    const { jobQueue } = setup();

    await startJobQueues();

    const [handlers] = jobQueue.registerHandlers.mock.calls[0];
    expect(handlers.map(handler => handler.accepts)).toContain(PurgeOrganizationInvitationEmailsJob);
  });

  it("creates a queue for the alert move that moving a deployment to another project enqueues", async () => {
    const { jobQueue } = setup();

    await startJobQueues();

    const [handlers] = jobQueue.registerHandlers.mock.calls[0];
    expect(handlers.map(handler => handler.accepts)).toContain(MoveDeploymentAlertsJob);
  });

  it("creates a queue for the affiliate commission sync a card payment settlement enqueues", async () => {
    const { jobQueue } = setup();

    await startJobQueues();

    const [handlers] = jobQueue.registerHandlers.mock.calls[0];
    expect(handlers.map(handler => handler.accepts)).toContain(SyncAffiliateCommission);
  });

  it("creates a queue for the referral program invitations the catch-up command enqueues", async () => {
    const { jobQueue } = setup();

    await startJobQueues();

    const [handlers] = jobQueue.registerHandlers.mock.calls[0];
    expect(handlers.map(handler => handler.accepts)).toContain(InviteAffiliate);
  });

  it("creates the queues of the gpu waitlist watch and the confirmation it enqueues", async () => {
    const { jobQueue } = setup();

    await startJobQueues();

    const [handlers] = jobQueue.registerHandlers.mock.calls[0];
    expect(handlers.map(handler => handler.accepts)).toEqual(expect.arrayContaining([WatchGpuWaitlists, ConfirmGpuPools]));
  });

  function setup() {
    const jobQueue = mock<JobQueueService>();
    container.registerInstance(JobQueueService, jobQueue);

    return { jobQueue };
  }
});
