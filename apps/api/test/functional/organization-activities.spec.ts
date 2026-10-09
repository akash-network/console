import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";

import {
  seedOrganizationActivity,
  seedOrganizationMember,
  seedOrganizationWithOwner,
  seedProject,
  seedProjectMember
} from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

type ActivityPage = { data: { id: string }[]; nextCursor: string | null };

describe("Organization activities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/organization-activities", () => {
    it("lists the activities of the active organization newest first, a page at a time", async () => {
      const { listActivities, team, owner } = await setupCaller({ role: "owner" });
      const project = await seedProject({ organizationId: team.id });
      const oldest = await seedOrganizationActivity({ organizationId: team.id, actorUserId: null, createdAt: new Date("2026-05-01T09:00:00.000Z") });
      const middle = await seedOrganizationActivity({
        organizationId: team.id,
        projectId: project.id,
        actorUserId: owner.id,
        type: "project_created",
        payload: { projectName: project.name },
        createdAt: new Date("2026-05-01T10:00:00.000Z")
      });
      const newest = await seedOrganizationActivity({ organizationId: team.id, createdAt: new Date("2026-05-01T11:00:00.000Z") });
      const { organization: other } = await seedOrganizationWithOwner();
      await seedOrganizationActivity({ organizationId: other.id });

      const firstResponse = await listActivities({ limit: "2" });
      const firstPage = (await firstResponse.json()) as ActivityPage;
      const secondResponse = await listActivities({ limit: "2", cursor: firstPage.nextCursor! });

      expect(firstResponse.status).toBe(200);
      expect(firstPage).toEqual({
        data: [
          expect.objectContaining({ id: newest.id }),
          {
            id: middle.id,
            projectId: project.id,
            actor: { id: owner.id, username: owner.username },
            type: "project_created",
            payload: { projectName: project.name },
            createdAt: "2026-05-01T10:00:00.000Z"
          }
        ],
        nextCursor: expect.any(String)
      });
      expect(await secondResponse.json()).toEqual({
        data: [{ id: oldest.id, projectId: null, actor: null, type: oldest.type, payload: oldest.payload, createdAt: "2026-05-01T09:00:00.000Z" }],
        nextCursor: null
      });
    });

    it("keeps to the project it is asked about", async () => {
      const { listActivities, team } = await setupCaller({ role: "admin" });
      const project = await seedProject({ organizationId: team.id });
      const inProject = await seedOrganizationActivity({ organizationId: team.id, projectId: project.id });
      await seedOrganizationActivity({ organizationId: team.id });

      const response = await listActivities({ projectId: project.id });

      expect(idsOf(await response.json())).toEqual([inProject.id]);
    });

    it.each(["member", "viewer"] as const)("shows a %s the activities of its granted projects and of the whole organization only", async role => {
      const { listActivities, team, user } = await setupCaller({ role });
      const granted = await seedProject({ organizationId: team.id });
      const notGranted = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: granted.id, userId: user.id, role: "viewer" });
      const organizationWide = await seedOrganizationActivity({ organizationId: team.id, createdAt: new Date("2026-05-01T09:00:00.000Z") });
      const inGranted = await seedOrganizationActivity({ organizationId: team.id, projectId: granted.id, createdAt: new Date("2026-05-01T10:00:00.000Z") });
      await seedOrganizationActivity({ organizationId: team.id, projectId: notGranted.id });

      const response = await listActivities({});

      expect(idsOf(await response.json())).toEqual([inGranted.id, organizationWide.id]);
    });

    it("refuses a cursor it did not hand out", async () => {
      const { listActivities } = await setupCaller({ role: "owner" });

      const response = await listActivities({ cursor: "not-a-cursor" });

      expect(response.status).toBe(400);
    });

    it("refuses a page larger than 100 activities", async () => {
      const { listActivities } = await setupCaller({ role: "owner" });

      const response = await listActivities({ limit: "101" });

      expect(response.status).toBe(400);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { listActivities } = await setupCaller({ role: "owner", organizationsOn: false });

      const response = await listActivities({});

      expect(response.status).toBe(404);
    });
  });

  function idsOf(body: unknown) {
    return (body as ActivityPage).data.map(({ id }) => id);
  }

  function signIn(externalUserId: string) {
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? externalUserId : null
    );

    return `Bearer ${token}`;
  }

  function enableOrganizationsFor(userIds: string[]) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return userIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setupCaller(input: { role: OrganizationRole; organizationsOn?: boolean }) {
    const { user: owner, organization: team } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const caller = input.role === "owner" ? owner : await seedUser(createSignedUpUserInput());
    if (input.role !== "owner") {
      await seedOrganizationMember({ organizationId: team.id, userId: caller.id, role: input.role });
    }
    const authorization = signIn(caller.userId!);
    enableOrganizationsFor(input.organizationsOn === false ? [] : [caller.id]);

    const listActivities = (query: Record<string, string>) =>
      app.request(`/v1/organization-activities?${new URLSearchParams(query)}`, { headers: { authorization, "x-organization-id": team.id } });

    return { listActivities, team, owner, user: caller };
  }
});
