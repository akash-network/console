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

  describe("recordOrganizationCreated", () => {
    it("files the activity into the new organization, outside the one the request runs in", async () => {
      const { service, organizationActivityRepository, unscopedRepository } = setup();
      const organization = { id: faker.string.uuid(), name: "Acme" };
      const actorUserId = faker.string.uuid();

      await service.recordOrganizationCreated(organization, actorUserId);

      expect(organizationActivityRepository.unscoped).toHaveBeenCalledWith("organization-provisioning");
      expect(unscopedRepository.create).toHaveBeenCalledWith({
        organizationId: organization.id,
        actorUserId,
        type: "organization_created",
        payload: { organizationName: "Acme" }
      });
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
  });

  function setup(input: { activities?: OrganizationActivityWithActor[] } = {}) {
    const ability = mock<AuthService["ability"]>();
    const organizationActivityRepository = mock<OrganizationActivityRepository>({ findPage: vi.fn().mockResolvedValue(input.activities ?? []) });
    const unscopedRepository = mock<OrganizationActivityRepository>();
    organizationActivityRepository.accessibleBy.mockReturnValue(organizationActivityRepository);
    organizationActivityRepository.unscoped.mockReturnValue(unscopedRepository);
    const authService = mock<AuthService>({ ability });

    const service = new OrganizationActivityService(organizationActivityRepository, authService);

    return { service, organizationActivityRepository, unscopedRepository, ability };
  }
});
