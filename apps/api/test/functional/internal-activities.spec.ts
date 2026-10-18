import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { systemClosedActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const PATH = "/internal/activities";

type AlertOverrides = { type?: string; dedupeKey?: string; organizationId?: string | null; projectId?: string | null; meta?: { dseq?: string } };

describe("POST /internal/activities", () => {
  const activityRepository = container.resolve(ActivityRepository);
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("rejects a caller with no token and writes nothing", async () => {
    const { user, alertFor } = await setup();

    const response = await addAlert(alertFor(), { token: undefined });

    expect(response.status).toBe(401);
    expect(await activityRepository.find({ userId: user.id })).toEqual([]);
  });

  it("rejects a caller with the wrong token and writes nothing", async () => {
    const { user, alertFor } = await setup();

    const response = await addAlert(alertFor(), { token: faker.string.alphanumeric(32) });

    expect(response.status).toBe(401);
    expect(await activityRepository.find({ userId: user.id })).toEqual([]);
  });

  it("adds an alert of the user's personal organization to their feed as an unseen info entry written by Console, filed in that organization", async () => {
    const { user, organization, alertFor } = await setup();
    const alert = alertFor({ type: "deployment_reclaim_alert", meta: { dseq: "4242" } });

    const response = await addAlert(alert);

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: user.id })).toEqual([
      expect.objectContaining({
        type: "deployment_reclaim_alert",
        status: "info",
        initiator: "system",
        meta: { alertId: alert.meta.alertId, summary: alert.meta.summary, dseq: "4242", organizationId: organization.id },
        dedupeKey: alert.dedupeKey,
        seenAt: null
      })
    ]);
  });

  it("adds an alert set before organizations to the user's feed, filed in no organization", async () => {
    const { user, alertFor } = await setup();
    const alert = alertFor({ organizationId: null, projectId: null });

    const response = await addAlert(alert);

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: user.id })).toEqual([expect.objectContaining({ meta: { alertId: alert.meta.alertId, summary: alert.meta.summary } })]);
  });

  it("adds a team alert to the feed of the member who set it while they can see its project", async () => {
    const { team, project, alertFor } = await setupTeam();
    const member = await seedTeamMember({ organizationId: team.id, grantedProjectIds: [project.id] });

    const response = await addAlert(alertFor(member.id, { type: "deployment_closed_alert", projectId: project.id, meta: { dseq: "777" } }));

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: member.id })).toEqual([
      expect.objectContaining({ type: "deployment_closed_alert", meta: expect.objectContaining({ dseq: "777" }) })
    ]);
  });

  it("adds a team wallet's alert in no project to the feed of the owner who set it, filed in the team", async () => {
    const { owner, team, alertFor } = await setupTeam();

    const response = await addAlert(alertFor(owner.id, { projectId: null }));

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: owner.id })).toEqual([
      expect.objectContaining({ type: "wallet_balance_alert", meta: expect.objectContaining({ organizationId: team.id }) })
    ]);
  });

  it("writes nothing for a member who left the team", async () => {
    const { project, alertFor } = await setupTeam();
    const departed = await seedUser();

    const response = await addAlert(alertFor(departed.id, { projectId: project.id }));

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: departed.id })).toEqual([]);
  });

  it("writes nothing for a member limited to another project of the team", async () => {
    const { team, project, alertFor } = await setupTeam();
    const otherProject = await seedProject({ organizationId: team.id });
    const member = await seedTeamMember({ organizationId: team.id, grantedProjectIds: [otherProject.id] });

    const response = await addAlert(alertFor(member.id, { type: "deployment_reclaim_alert", projectId: project.id, meta: { dseq: "888" } }));

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: member.id })).toEqual([]);
  });

  it("writes nothing for an owner of a team that was deleted", async () => {
    const { owner, project, alertFor } = await setupTeam({ deletedAt: new Date() });

    const response = await addAlert(alertFor(owner.id, { projectId: project.id }));

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: owner.id })).toEqual([]);
  });

  it("writes nothing for a team member while organizations are off for them", async () => {
    const { team, project, alertFor } = await setupTeam({ organizationsOn: false });
    const member = await seedTeamMember({ organizationId: team.id, grantedProjectIds: [project.id] });

    const response = await addAlert(alertFor(member.id, { projectId: project.id }));

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: member.id })).toEqual([]);
  });

  it("keeps one entry when the same alert is sent again", async () => {
    const { user, alertFor } = await setup();
    const alert = alertFor();

    const first = await addAlert(alert);
    const repeat = await addAlert(alert);

    expect([first.status, repeat.status]).toEqual([204, 204]);
    expect(await activityRepository.find({ userId: user.id })).toHaveLength(1);
  });

  it("keeps one entry when the same alert arrives twice at once", async () => {
    const { user, alertFor } = await setup();
    const alert = alertFor();

    const responses = await Promise.all([addAlert(alert), addAlert(alert)]);

    expect(responses.map(response => response.status)).toEqual([204, 204]);
    expect(await activityRepository.find({ userId: user.id })).toHaveLength(1);
  });

  it("leaves the close of a deployment as its only entry when its deployment-closed alert arrives", async () => {
    const { user, alertFor } = await setup();
    const owner = createAkashAddress();
    const close = await activityRepository.create(systemClosedActivityOf({ userId: user.id, owner, dseq: "5150", reason: "trial_ended" }));

    const response = await addAlert(
      alertFor({ type: "deployment_closed_alert", dedupeKey: deploymentCloseDedupeKeyOf({ owner, dseq: "5150" }), meta: { dseq: "5150" } })
    );

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: user.id })).toEqual([close]);
  });

  it("adds an alert whose dedupe key only another user holds", async () => {
    const { user, alertFor } = await setup();
    const stranger = await setup();
    const alert = alertFor();
    await addAlert(stranger.alertFor({ dedupeKey: alert.dedupeKey }));

    const response = await addAlert(alert);

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: user.id })).toEqual([expect.objectContaining({ dedupeKey: alert.dedupeKey })]);
  });

  it("answers 404 for a user console-api does not know", async () => {
    const { alertFor } = await setup();

    const response = await addAlert({ ...alertFor({ organizationId: null, projectId: null }), userId: faker.string.uuid() });

    expect(response.status).toBe(404);
  });

  it.each([
    ["a user id that is not a uuid", { userId: "user-1" }],
    ["no organization id", { organizationId: undefined }],
    ["an organization id that is not a uuid", { organizationId: "team-1" }],
    ["no project id", { projectId: undefined }],
    ["an action type", { type: "deployment_close" }],
    ["a status other than info", { status: "succeeded" }],
    ["an empty dedupe key", { dedupeKey: "" }],
    ["no dedupe key", { dedupeKey: undefined }],
    ["an alert id that is not a uuid", { meta: { alertId: "alert-1", summary: "Low balance" } }],
    ["an empty summary", { meta: { alertId: faker.string.uuid(), summary: "" } }],
    ["an empty dseq", { meta: { alertId: faker.string.uuid(), summary: "Low balance", dseq: "" } }]
  ])("refuses %s through the shared error handler and writes nothing", async (_, invalid) => {
    const { user, alertFor } = await setup();

    const response = await addAlert({ ...alertFor(), ...invalid });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "BadRequestError", code: "validation_error" });
    expect(await activityRepository.find({ userId: user.id })).toEqual([]);
  });

  it("stays out of the unauthenticated internal openapi document", async () => {
    const response = await app.request("/internal/doc");

    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain("createAlertActivity");
  });

  async function addAlert(body: Record<string, unknown>, options: { token?: string } = { token: internalToken }) {
    return await app.request(PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.token ? { "x-console-internal-token": options.token } : {})
      },
      body: JSON.stringify(body)
    });
  }

  function alertOf(userId: string, filing: { organizationId: string | null; projectId: string | null }, overrides: AlertOverrides) {
    const alertId = faker.string.uuid();

    return {
      userId,
      organizationId: filing.organizationId,
      projectId: filing.projectId,
      type: "wallet_balance_alert",
      status: "info",
      dedupeKey: `${alertId}.${faker.number.int({ min: 1_000_000, max: 9_000_000 })}`,
      ...overrides,
      meta: { alertId, summary: `Balance below ${faker.number.int({ min: 1, max: 100 })} USD`, ...overrides.meta }
    };
  }

  async function seedTeamMember({ organizationId, grantedProjectIds }: { organizationId: string; grantedProjectIds: string[] }) {
    const member = await seedUser();
    await seedOrganizationMember({ organizationId, userId: member.id, role: "member", projectAccess: "selected" });
    for (const projectId of grantedProjectIds) {
      await seedProjectMember({ organizationId, projectId, userId: member.id });
    }

    return member;
  }

  async function setupTeam({ organizationsOn = true, ...organization }: { deletedAt?: Date; organizationsOn?: boolean } = {}) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => organizationsOn && flag !== FeatureFlags.ORGANIZATIONS_ENFORCE);
    const { user: owner, organization: team, project } = await seedOrganizationWithOwner(organization);

    return {
      owner,
      team,
      project,
      alertFor: (userId: string, overrides: AlertOverrides = {}) => alertOf(userId, { organizationId: team.id, projectId: project.id }, overrides)
    };
  }

  async function setup() {
    const { user, organization, project } = await seedOrganizationWithOwner({ type: "personal" });

    return {
      user,
      organization,
      alertFor: (overrides: AlertOverrides = {}) => alertOf(user.id, { organizationId: organization.id, projectId: project.id }, overrides)
    };
  }
});
