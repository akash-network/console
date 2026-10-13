import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ProjectMemberRepository } from "./project-member.repository";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(ProjectMemberRepository.name, () => {
  describe("createManyUnlessExist", () => {
    it("grants every project the user does not hold yet and skips the ones they already hold", async () => {
      const { repository, organization, project, member } = await setup();
      const other = await seedProject({ organizationId: organization.id });
      await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: member.id, role: "viewer" });

      const created = await repository.createManyUnlessExist([
        { organizationId: organization.id, projectId: project.id, userId: member.id, role: "admin" },
        { organizationId: organization.id, projectId: other.id, userId: member.id, role: "member" }
      ]);

      expect(created).toEqual([expect.objectContaining({ projectId: other.id, userId: member.id, role: "member" })]);
      expect(await repository.find({ userId: member.id, projectId: project.id })).toEqual([expect.objectContaining({ role: "viewer" })]);
      expect(await repository.count({ userId: member.id })).toBe(2);
    });

    it("creates nothing for an empty list", async () => {
      const { repository, member } = await setup();

      expect(await repository.createManyUnlessExist([])).toEqual([]);
      expect(await repository.count({ userId: member.id })).toBe(0);
    });
  });

  async function setup() {
    const repository = container.resolve(ProjectMemberRepository);
    const { organization, project } = await seedOrganizationWithOwner();
    const member = await seedUser();
    await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" });

    return { repository, organization, project, member };
  }
});
