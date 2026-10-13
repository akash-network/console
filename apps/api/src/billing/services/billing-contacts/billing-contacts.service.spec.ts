import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { UserRepository } from "@src/user/repositories";
import { BillingContactsService } from "./billing-contacts.service";

import { createOrganization } from "@test/seeders/organization.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(BillingContactsService.name, () => {
  describe("findForPayer", () => {
    it("names the acting user when they pay for themselves", async () => {
      const { service, organizationMemberRepository } = setup();
      const user = createUser();

      expect(await service.findForPayer({ user })).toEqual([user]);
      expect(organizationMemberRepository.findBillingContacts).not.toHaveBeenCalled();
    });

    it("names a team's owners and billing members when the team pays", async () => {
      const contacts = [createUser(), createUser()];
      const { service, organizationMemberRepository } = setup({ contacts });
      const team = createOrganization({ type: "team" });

      expect(await service.findForPayer({ user: createUser(), team })).toEqual(contacts);
      expect(organizationMemberRepository.findBillingContacts).toHaveBeenCalledWith(team.id);
    });
  });

  describe("findForPayer when no member acts for the team", () => {
    it("names the team's owners and billing members", async () => {
      const contacts = [createUser()];
      const { service } = setup({ contacts });
      const team = createOrganization({ type: "team" });

      expect(await service.findForPayer({ user: null, team })).toEqual(contacts);
    });
  });

  describe("findForWallet", () => {
    it("names the user of a personal wallet", async () => {
      const user = createUser();
      const { service, userRepository } = setup({ user });

      expect(await service.findForWallet({ userId: user.id, organizationId: "org-personal" })).toEqual([user]);
      expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    });

    it("names nobody for a personal wallet whose user is gone", async () => {
      const { service } = setup();

      expect(await service.findForWallet({ userId: "user-gone", organizationId: null })).toEqual([]);
    });

    it("names a team wallet's owners and billing members", async () => {
      const contacts = [createUser()];
      const { service, organizationMemberRepository, userRepository } = setup({ contacts });

      expect(await service.findForWallet({ userId: null, organizationId: "org-team" })).toEqual(contacts);
      expect(organizationMemberRepository.findBillingContacts).toHaveBeenCalledWith("org-team");
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it("names nobody for a wallet that belongs to neither a user nor an organization", async () => {
      const { service, organizationMemberRepository } = setup({ contacts: [createUser()] });

      expect(await service.findForWallet({ userId: null, organizationId: null })).toEqual([]);
      expect(organizationMemberRepository.findBillingContacts).not.toHaveBeenCalled();
    });
  });

  function setup(input: { user?: ReturnType<typeof createUser>; contacts?: ReturnType<typeof createUser>[] } = {}) {
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(input.user);
    const organizationMemberRepository = mock<OrganizationMemberRepository>();
    organizationMemberRepository.findBillingContacts.mockResolvedValue(input.contacts ?? []);
    const service = new BillingContactsService(userRepository, organizationMemberRepository);

    return { service, userRepository, organizationMemberRepository };
  }
});
