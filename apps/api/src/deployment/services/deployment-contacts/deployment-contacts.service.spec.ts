import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { DeploymentContactsService } from "./deployment-contacts.service";

import { createUser } from "@test/seeders/user.seeder";

const TEAM_ID = "0b6f7c2e-3d4a-4e5f-8a9b-1c2d3e4f5a6b";

describe(DeploymentContactsService.name, () => {
  describe("findFor", () => {
    it("names the user of a personal wallet without reading any membership", async () => {
      const user = createUser();
      const { service, userRepository, organizationMemberRepository } = setup({ user });

      expect(await service.findFor({ wallet: { userId: user.id, organizationId: "org-personal" }, filingUserId: user.id })).toEqual([user]);
      expect(userRepository.findById).toHaveBeenCalledWith(user.id);
      expect(organizationMemberRepository.findMemberUser).not.toHaveBeenCalled();
      expect(organizationMemberRepository.findOwners).not.toHaveBeenCalled();
    });

    it("names nobody for a personal wallet whose user is gone", async () => {
      const { service } = setup();

      expect(await service.findFor({ wallet: { userId: "user-gone", organizationId: null }, filingUserId: "user-gone" })).toEqual([]);
    });

    it("names the filer of a deployment whose wallet belongs to no organization", async () => {
      const user = createUser();
      const { service, organizationMemberRepository } = setup({ user });

      expect(await service.findFor({ wallet: { userId: null, organizationId: null }, filingUserId: user.id })).toEqual([user]);
      expect(organizationMemberRepository.findOwners).not.toHaveBeenCalled();
    });

    it("names the member who filed a team deployment while they still belong to the team", async () => {
      const filer = createUser();
      const { service, organizationMemberRepository, userRepository } = setup({ filer, owners: [createUser()] });

      expect(await service.findFor({ wallet: { userId: null, organizationId: TEAM_ID }, filingUserId: filer.id })).toEqual([filer]);
      expect(organizationMemberRepository.findMemberUser).toHaveBeenCalledWith(TEAM_ID, filer.id);
      expect(organizationMemberRepository.findOwners).not.toHaveBeenCalled();
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it("names the team's owners in place of a filer who has left the team", async () => {
      const owners = [createUser(), createUser()];
      const { service, organizationMemberRepository } = setup({ owners });

      expect(await service.findFor({ wallet: { userId: null, organizationId: TEAM_ID }, filingUserId: "member-gone" })).toEqual(owners);
      expect(organizationMemberRepository.findOwners).toHaveBeenCalledWith(TEAM_ID);
    });

    it("names the team's owners in place of a filer who has deleted their account", async () => {
      const owners = [createUser(), createUser()];
      const { service, organizationMemberRepository } = setup({ filer: createUser(), owners });

      expect(await service.findFor({ wallet: { userId: null, organizationId: TEAM_ID }, filingUserId: null })).toEqual(owners);
      expect(organizationMemberRepository.findMemberUser).not.toHaveBeenCalled();
      expect(organizationMemberRepository.findOwners).toHaveBeenCalledWith(TEAM_ID);
    });

    it("names nobody for a deployment outside a team whose filer has deleted their account", async () => {
      const { service, userRepository } = setup({ user: createUser() });

      expect(await service.findFor({ wallet: { userId: null, organizationId: null }, filingUserId: null })).toEqual([]);
      expect(userRepository.findById).not.toHaveBeenCalled();
    });
  });

  function setup(input: { user?: UserOutput; filer?: UserOutput; owners?: UserOutput[] } = {}) {
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(input.user);

    const organizationMemberRepository = mock<OrganizationMemberRepository>();
    organizationMemberRepository.findMemberUser.mockResolvedValue(input.filer);
    organizationMemberRepository.findOwners.mockResolvedValue(input.owners ?? []);

    const service = new DeploymentContactsService(userRepository, organizationMemberRepository);

    return { service, userRepository, organizationMemberRepository };
  }
});
