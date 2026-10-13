import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationMemberOutput, OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { LAST_OWNER_ERROR_CODE, OrganizationMemberService } from "./organization-member.service";

import { createOrganizationMember } from "@test/seeders/organization.seeder";

describe(OrganizationMemberService.name, () => {
  describe("assertAnotherOwnerRemains", () => {
    it("lets an owner go while another owner stays", async () => {
      const leaving = createOwner();
      const { service, organizationId } = setup({ owners: [leaving, createOwner()] });

      await expect(service.assertAnotherOwnerRemains(organizationId, leaving.userId)).resolves.toBeUndefined();
    });

    it("lets a member who is not an owner go", async () => {
      const { service, organizationId } = setup({ owners: [createOwner()] });

      await expect(service.assertAnotherOwnerRemains(organizationId, faker.string.uuid())).resolves.toBeUndefined();
    });

    it("refuses to let the only owner go", async () => {
      const onlyOwner = createOwner();
      const { service, organizationId } = setup({ owners: [onlyOwner] });

      await expect(service.assertAnotherOwnerRemains(organizationId, onlyOwner.userId)).rejects.toMatchObject({
        status: 409,
        errorCode: LAST_OWNER_ERROR_CODE,
        message: "An organization needs at least one owner"
      });
    });

    it("locks the owners of the organization it checks", async () => {
      const { service, organizationId, organizationMemberRepository } = setup({ owners: [createOwner(), createOwner()] });

      await service.assertAnotherOwnerRemains(organizationId, faker.string.uuid());

      expect(organizationMemberRepository.lockOwners).toHaveBeenCalledWith(organizationId);
    });
  });

  function createOwner(): OrganizationMemberOutput {
    return createOrganizationMember({ role: "owner" });
  }

  function setup(input: { owners: OrganizationMemberOutput[] }) {
    const organizationId = faker.string.uuid();
    const organizationMemberRepository = mock<OrganizationMemberRepository>({ lockOwners: vi.fn().mockResolvedValue(input.owners) });
    const service = new OrganizationMemberService(organizationMemberRepository);

    return { service, organizationId, organizationMemberRepository };
  }
});
