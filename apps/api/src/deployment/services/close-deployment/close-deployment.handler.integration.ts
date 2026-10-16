import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import createError from "http-errors";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { type ApiPgDatabase, type EnqueueOptions, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { ACCESS_REVOKED_ERROR_CODE } from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { pendingCloseActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { CloseDeploymentHandler } from "./close-deployment.handler";
import { CLOSE_DEPLOYMENT_RETRY_OPTIONS, CloseDeployment, closeDeploymentKeyFor } from "./close-deployment.job";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(CloseDeploymentHandler)]);

type Revocation = "membership" | "projectGrant" | "role" | "team";

const ACCESS_REVOKED = { code: ACCESS_REVOKED_ERROR_CODE, message: "You no longer have access to this deployment." };

describe(CloseDeploymentHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes the deployment with the user's wallet and records the close as succeeded, run the way a worker runs it", async () => {
    const { actor, wallet, dseq, close, closeInBackground, findActivity, awaitCompleted } = await setup();

    await closeInBackground();

    await awaitCompleted();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id, address: wallet.address }), dseq, { actingUserId: actor.id });
    expect(await findActivity()).toMatchObject({ status: "succeeded", meta: { dseq } });
  });

  it("closes a team deployment for a member who still has access to its project, under the organization wallet's key the request opened it with", async () => {
    const { actor, owner, dseq, close, closeInBackground, findActivity, awaitCompleted } = await setup({ inTeam: true });

    await closeInBackground();

    await awaitCompleted();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ userId: null, address: owner }), dseq, { actingUserId: actor.id });
    expect(await findActivity()).toMatchObject({ status: "succeeded", dedupeKey: deploymentCloseDedupeKeyOf({ owner, dseq }) });
  });

  it.each([
    { change: "was removed from the team", revoke: "membership" },
    { change: "lost access to the deployment's project", revoke: "projectGrant" },
    { change: "became a viewer of the team", revoke: "role" },
    { change: "saw the team deleted", revoke: "team" }
  ] as const)("signs nothing and records the close as failed without a retry for a member who $change since the close was queued", async ({ revoke }) => {
    const { close, closeInBackground, findActivity, awaitCompleted } = await setup({ inTeam: true, revoke });

    await closeInBackground();

    await awaitCompleted();
    expect(close).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "failed", dedupeKey: null, meta: { error: ACCESS_REVOKED } });
  });

  it("keeps the bulk close the close was part of in the activity it settles", async () => {
    const { dseq, closeInBackground, findActivity, awaitCompleted } = await setup({ batchId: "b47c4a2e-5f0d-4c1e-9a7b-2d3e4f5a6b7c" });

    await closeInBackground();

    await awaitCompleted();
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

  async function setup(input: { batchId?: string; inTeam?: boolean; revoke?: Revocation } = {}) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.ORGANIZATIONS_ENFORCE);
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const team = input.inTeam ? await seedTeamDeployment() : undefined;
    if (team && input.revoke) await team.revoke(input.revoke);
    const { actor, wallet, dseq } = team ?? (await seedPersonalDeployment());
    const owner = wallet.address;
    const activity = await activityRepository.create(pendingCloseActivityOf({ userId: actor.id, owner, dseq, batchId: input.batchId }));
    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockResolvedValue(true);
    const singletonKey = closeDeploymentKeyFor({ userId: actor.id, dseq });

    return {
      actor,
      wallet,
      owner,
      dseq,
      close,
      awaitCompleted: () => expectJobCompleted(CloseDeployment[JOB_NAME], { singletonKey }),
      closeInBackground: async (retryOverrides: EnqueueOptions = {}) => {
        await enqueue(new CloseDeployment({ userId: actor.id, dseq, activityId: activity.id, batchId: input.batchId, walletId: team?.wallet.id }), {
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

  async function seedPersonalDeployment() {
    const { user, wallet, address } = await seedUserWithWallet();

    return { actor: user, wallet: { ...wallet, address }, dseq: faker.string.numeric(7) };
  }

  async function seedTeamDeployment() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const { organization } = await seedOrganizationWithOwner();
    const project = await seedProject({ organizationId: organization.id });
    const member = await seedUser();
    const membership = await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" });
    const grant = await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: member.id, role: "member" });
    const wallet = await seedOrganizationWallet({ organizationId: organization.id, activatedAt: new Date() });
    const { dseq } = await seedDeploymentSetting({ userId: member.id, organizationId: organization.id, projectId: project.id });

    const revocations: Record<Revocation, () => Promise<unknown>> = {
      membership: () => db.delete(resolveTable("OrganizationMembers")).where(eq(resolveTable("OrganizationMembers").id, membership.id)),
      projectGrant: () => db.delete(resolveTable("ProjectMembers")).where(eq(resolveTable("ProjectMembers").id, grant.id)),
      role: () =>
        db
          .update(resolveTable("OrganizationMembers"))
          .set({ role: "viewer" })
          .where(eq(resolveTable("OrganizationMembers").id, membership.id)),
      team: () =>
        db
          .update(resolveTable("Organizations"))
          .set({ deletedAt: new Date() })
          .where(eq(resolveTable("Organizations").id, organization.id))
    };

    return { actor: member, wallet, dseq, revoke: async (revocation: Revocation) => await revocations[revocation]() };
  }
});
