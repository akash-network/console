import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type {
  LockedTeam,
  TeamEligibility,
  TeamOrganizationDeletionService
} from "@src/organization/services/team-organization-deletion/team-organization-deletion.service";
import { AccountTeamsService } from "./account-teams.service";

import { createOrganizationWallet } from "@test/seeders/user-wallet.seeder";

describe(AccountTeamsService.name, () => {
  describe("assess", () => {
    it("sends the teams the account is the only member of along with it, assessed as they stand, and the others to transfer", async () => {
      const alone = team();
      const shared = team();
      const eligibility: TeamEligibility = { activeDeploymentDseqs: ["7"], forfeitableBalanceUsd: 4.5 };
      const { service, memberRepository, teamDeletionService } = setup({ memberCounts: { [alone.id]: 1, [shared.id]: 3 } });
      teamDeletionService.assessUnlocked.mockResolvedValue(eligibility);

      expect(await service.assess([alone, shared])).toEqual({ goingWithAccount: [{ ...alone, ...eligibility }], toTransfer: [shared] });
      expect(memberRepository.unscoped).toHaveBeenCalledWith("account-deletion");
      expect(memberRepository.count).toHaveBeenCalledWith({ organizationId: alone.id });
      expect(teamDeletionService.assessUnlocked).toHaveBeenCalledTimes(1);
      expect(teamDeletionService.assessUnlocked).toHaveBeenCalledWith(alone.id);
      expect(teamDeletionService.lockForDeletion).not.toHaveBeenCalled();
    });
  });

  describe("lockAndAssess", () => {
    it("locks each team before counting its members, and assesses only the teams going with the account under that lock", async () => {
      const alone = team();
      const shared = team();
      const locked: LockedTeam = { id: alone.id, wallet: createOrganizationWallet({ organizationId: alone.id }) };
      const eligibility: TeamEligibility = { activeDeploymentDseqs: [], forfeitableBalanceUsd: 3 };
      const { service, memberRepository, teamDeletionService } = setup({ memberCounts: { [alone.id]: 1, [shared.id]: 2 } });
      teamDeletionService.lockForDeletion.mockImplementation(async id => (id === alone.id ? locked : { id, wallet: undefined }));
      teamDeletionService.assess.mockResolvedValue(eligibility);

      expect(await service.lockAndAssess([alone, shared])).toEqual({ goingWithAccount: [{ ...alone, ...eligibility, locked }], toTransfer: [shared] });
      expect(teamDeletionService.assess).toHaveBeenCalledTimes(1);
      expect(teamDeletionService.assess).toHaveBeenCalledWith(locked);
      expect(teamDeletionService.lockForDeletion.mock.invocationCallOrder[0]).toBeLessThan(memberRepository.count.mock.invocationCallOrder[0]);
    });

    it("leaves out a team deleted while the account was being deleted", async () => {
      const gone = team();
      const { service, memberRepository, teamDeletionService } = setup({ memberCounts: { [gone.id]: 1 } });
      teamDeletionService.lockForDeletion.mockResolvedValue(undefined);

      expect(await service.lockAndAssess([gone])).toEqual({ goingWithAccount: [], toTransfer: [] });
      expect(memberRepository.count).not.toHaveBeenCalled();
      expect(teamDeletionService.assess).not.toHaveBeenCalled();
    });
  });

  describe("eraseWithAccount", () => {
    it("deletes each team as locked, in the name of the account being deleted", async () => {
      const { service, teamDeletionService } = setup();
      const first: LockedTeam = { id: faker.string.uuid(), wallet: undefined };
      const second: LockedTeam = { id: faker.string.uuid(), wallet: createOrganizationWallet({ organizationId: faker.string.uuid() }) };
      const userId = faker.string.uuid();

      await service.eraseWithAccount(
        [first, second].map(locked => ({ ...team(), activeDeploymentDseqs: [], forfeitableBalanceUsd: 0, locked })),
        userId
      );

      expect(teamDeletionService.erase.mock.calls).toEqual([
        [first, userId],
        [second, userId]
      ]);
    });
  });

  function team() {
    return { id: faker.string.uuid(), name: faker.company.name() };
  }

  function setup(input: { memberCounts?: Record<string, number> } = {}) {
    const memberRepository = mock<OrganizationMemberRepository>();
    memberRepository.unscoped.mockReturnValue(memberRepository);
    memberRepository.count.mockImplementation(async query => input.memberCounts?.[query?.organizationId ?? ""] ?? 1);
    const teamDeletionService = mock<TeamOrganizationDeletionService>();

    return { service: new AccountTeamsService(memberRepository, teamDeletionService), memberRepository, teamDeletionService };
  }
});
