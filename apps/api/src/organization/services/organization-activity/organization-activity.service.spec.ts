import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { encodeActivityCursor } from "@src/activity/lib/activity-cursor/activity-cursor";
import type { AuthService } from "@src/auth/services/auth.service";
import type {
  OrganizationActivityRepository,
  OrganizationActivityWithActor
} from "@src/organization/repositories/organization-activity/organization-activity.repository";
import { OrganizationActivityService } from "./organization-activity.service";

import { createOrganizationActivity } from "@test/seeders/organization.seeder";

describe(OrganizationActivityService.name, () => {
  describe("record", () => {
    it("writes the activity as given", async () => {
      const { service, organizationActivityRepository } = setup();
      const activity = {
        organizationId: faker.string.uuid(),
        type: "project_created" as const,
        actorUserId: faker.string.uuid(),
        projectId: faker.string.uuid(),
        payload: { projectName: "web" }
      };

      await service.record(activity);

      expect(organizationActivityRepository.create).toHaveBeenCalledWith(activity);
    });
  });

  describe("recordForDeployment", () => {
    it("files the activity into the deployment's organization, outside the one the request runs in", async () => {
      const { service, organizationActivityRepository, unscopedRepository } = setup();
      const activity = {
        organizationId: faker.string.uuid(),
        projectId: faker.string.uuid(),
        type: "deployment_closed" as const,
        actorUserId: null,
        payload: { dseq: "1234", name: "web", reason: "provider_unreachable" }
      };

      await service.recordForDeployment(activity);

      expect(organizationActivityRepository.unscoped).toHaveBeenCalledWith("deployment-activity");
      expect(unscopedRepository.create).toHaveBeenCalledWith(activity);
      expect(organizationActivityRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("recordTeamCreated", () => {
    it("files the activity into the new team, outside the organization the request runs in", async () => {
      const { service, organizationActivityRepository, unscopedRepository } = setup();
      const activity = {
        organizationId: faker.string.uuid(),
        type: "organization_created" as const,
        actorUserId: faker.string.uuid(),
        payload: { organizationName: "Acme Corp" }
      };

      await service.recordTeamCreated(activity);

      expect(organizationActivityRepository.unscoped).toHaveBeenCalledWith("organization-creation");
      expect(unscopedRepository.create).toHaveBeenCalledWith(activity);
      expect(organizationActivityRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("recordJoined", () => {
    it("files the activity into the joined team, outside the organization the request runs in", async () => {
      const { service, organizationActivityRepository, unscopedRepository } = setup();
      const activity = {
        organizationId: faker.string.uuid(),
        type: "member_joined" as const,
        actorUserId: faker.string.uuid(),
        payload: { role: "member" as const }
      };

      await service.recordJoined(activity);

      expect(organizationActivityRepository.unscoped).toHaveBeenCalledWith("invitation-by-token");
      expect(unscopedRepository.create).toHaveBeenCalledWith(activity);
      expect(organizationActivityRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("reads one activity past the page within the caller's rules and points the next page at the last one shown", async () => {
      const activities = [createOrganizationActivity(), createOrganizationActivity(), createOrganizationActivity()];
      const { service, organizationActivityRepository, ability } = setup({ activities });
      const projectId = faker.string.uuid();

      const page = await service.list({ limit: 2, projectId });

      expect(organizationActivityRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(organizationActivityRepository.findPage).toHaveBeenCalledWith({ limit: 3, after: undefined, projectId });
      expect(page).toEqual({
        activities: activities.slice(0, 2),
        nextCursor: encodeActivityCursor({ createdAt: activities[1].createdAt.toISOString(), id: activities[1].id })
      });
    });

    it("has no next page once every activity fits", async () => {
      const activities = [createOrganizationActivity(), createOrganizationActivity()];
      const { service } = setup({ activities });

      const page = await service.list({ limit: 2 });

      expect(page).toEqual({ activities, nextCursor: null });
    });

    it("starts the page after the activity the cursor points at", async () => {
      const { service, organizationActivityRepository } = setup();
      const position = { createdAt: faker.date.recent().toISOString(), id: faker.string.uuid() };

      await service.list({ limit: 20, cursor: encodeActivityCursor(position) });

      expect(organizationActivityRepository.findPage).toHaveBeenCalledWith({ limit: 21, after: position, projectId: undefined });
    });

    it("refuses a cursor it did not hand out", async () => {
      const { service, organizationActivityRepository } = setup();

      await expect(service.list({ limit: 20, cursor: "not-a-cursor" })).rejects.toMatchObject({ status: 400 });
      expect(organizationActivityRepository.findPage).not.toHaveBeenCalled();
    });

    it("shows the invitee's email to a caller who may read the invitations of the activity's organization", async () => {
      const invited = createInvitedActivity();
      const { service } = setup({
        activities: [invited],
        rules: [{ action: "read", subject: "OrganizationInvitation", conditions: { organizationId: invited.organizationId } }]
      });

      const page = await service.list({ limit: 20 });

      expect(page.activities).toEqual([invited]);
    });

    it("hides the invitee's email from a caller who may not read invitations, keeping the rest of the activity", async () => {
      const invited = createInvitedActivity();
      const { service } = setup({
        activities: [invited],
        rules: [{ action: "read", subject: ["OrganizationActivity", "OrganizationMember"], conditions: { organizationId: invited.organizationId } }]
      });

      const page = await service.list({ limit: 20 });

      expect(page.activities).toEqual([{ ...invited, payload: { role: "admin" } }]);
    });

    it("hides the invitee's email from a caller who may read the invitations of another organization only", async () => {
      const invited = createInvitedActivity();
      const { service } = setup({
        activities: [invited],
        rules: [{ action: "read", subject: "OrganizationInvitation", conditions: { organizationId: faker.string.uuid() } }]
      });

      const page = await service.list({ limit: 20 });

      expect(page.activities).toEqual([{ ...invited, payload: { role: "admin" } }]);
    });

    it("leaves the payload of every other type as stored for a caller who may not read invitations", async () => {
      const joined = createOrganizationActivity({ type: "member_joined", projectId: null, payload: { role: "member", email: "lena@acme.com" } });
      const { service } = setup({ activities: [joined], rules: [] });

      const page = await service.list({ limit: 20 });

      expect(page.activities).toEqual([joined]);
    });

    it("points the next page at the last activity shown when it hides an email", async () => {
      const activities = [createInvitedActivity(), createInvitedActivity()];
      const { service } = setup({ activities, rules: [] });

      const page = await service.list({ limit: 1 });

      expect(page.nextCursor).toBe(encodeActivityCursor({ createdAt: activities[0].createdAt.toISOString(), id: activities[0].id }));
    });
  });

  function createInvitedActivity() {
    return createOrganizationActivity({ type: "member_invited", projectId: null, payload: { email: "lena@acme.com", role: "admin" } });
  }

  function setup(input: { activities?: OrganizationActivityWithActor[]; rules?: RawRuleOf<MongoAbility>[] } = {}) {
    const organizationActivityRepository = mock<OrganizationActivityRepository>({ findPage: vi.fn().mockResolvedValue(input.activities ?? []) });
    const unscopedRepository = mock<OrganizationActivityRepository>();
    organizationActivityRepository.accessibleBy.mockReturnValue(organizationActivityRepository);
    organizationActivityRepository.unscoped.mockReturnValue(unscopedRepository);
    const authService = mock<AuthService>();
    authService.ability = input.rules ? createMongoAbility(input.rules) : mock<AuthService["ability"]>();

    const service = new OrganizationActivityService(organizationActivityRepository, authService);

    return { service, organizationActivityRepository, unscopedRepository, ability: authService.ability };
  }
});
