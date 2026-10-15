import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { MoveDeploymentAlertsHandler } from "./move-deployment-alerts.handler";
import { MOVE_DEPLOYMENT_ALERTS_RETRY_OPTIONS, MoveDeploymentAlertsJob } from "./move-deployment-alerts.job";

import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const JOB = MoveDeploymentAlertsJob[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(MoveDeploymentAlertsHandler)]);

describe(MoveDeploymentAlertsHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("files the team wallet's alerts of the deployment into the project the deployment is filed in", async () => {
    const { organization, teamWallet, dseq, targetProject, moveAlerts, alertMoves } = await setup();

    await moveAlerts();

    expect(alertMoves()).toEqual([
      {
        path: `/internal/v1/organizations/${organization.id}/deployment-alerts/${dseq}/project`,
        body: { data: { owner: teamWallet?.address, projectId: targetProject.id } }
      }
    ]);
  });

  it("files nothing for a deployment the organization has no row for", async () => {
    const { moveAlerts, alertMoves } = await setup({ hasDeployment: false });

    await moveAlerts();

    expect(alertMoves()).toEqual([]);
  });

  it("files nothing for a deployment whose owner wallet is gone, since its alerts cannot be told from another wallet's", async () => {
    const { moveAlerts, alertMoves } = await setup({ hasTeamWallet: false });

    await moveAlerts();

    expect(alertMoves()).toEqual([]);
  });

  it("retries while the notifications service refuses", async () => {
    const { enqueueMove, startWorkers, organization, dseq } = await setup({ notificationsStatus: 404 });

    await enqueueMove();
    await startWorkers();

    await vi.waitFor(
      async () => expect(await findJobRows(JOB, { data: { organizationId: organization.id, dseq } })).toEqual([expect.objectContaining({ state: "retry" })]),
      {
        timeout: 20_000,
        interval: 250
      }
    );
  });

  async function setup(input: { hasDeployment?: boolean; hasTeamWallet?: boolean; notificationsStatus?: number } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const baseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;
    const { user, organization } = await seedOrganizationWithOwner({ type: "team" });
    const teamWallet = input.hasTeamWallet === false ? undefined : await seedOrganizationWallet({ organizationId: organization.id, createdByUserId: user.id });
    const targetProject = await seedProject({ organizationId: organization.id });
    const dseq = createDseq();

    if (input.hasDeployment !== false) {
      await seedDeploymentSetting({ userId: user.id, organizationId: organization.id, projectId: targetProject.id, dseq });
    }

    const moves: { path: string; body: unknown }[] = [];
    nock(baseUrl)
      .persist()
      .put(new RegExp(`^/internal/v1/organizations/${organization.id}/deployment-alerts/\\d+/project$`))
      .reply(function reply(this: nock.ReplyFnContext, uri, body) {
        moves.push({ path: uri, body });

        return [input.notificationsStatus ?? 204];
      });

    const enqueueMove = () => enqueue(new MoveDeploymentAlertsJob({ organizationId: organization.id, dseq }), MOVE_DEPLOYMENT_ALERTS_RETRY_OPTIONS);

    return {
      organization,
      teamWallet,
      dseq,
      targetProject,
      enqueueMove,
      startWorkers,
      alertMoves: () => moves,
      moveAlerts: async () => {
        await enqueueMove();
        await startWorkers();
        await expectJobCompleted(JOB, { data: { organizationId: organization.id, dseq } });
      }
    };
  }
});
