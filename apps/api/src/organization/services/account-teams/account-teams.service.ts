import { singleton } from "tsyringe";

import type { OrganizationOutput } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import {
  type LockedTeam,
  type TeamEligibility,
  TeamOrganizationDeletionService
} from "@src/organization/services/team-organization-deletion/team-organization-deletion.service";

export type TeamReference = Pick<OrganizationOutput, "id" | "name">;

export type TeamGoingWithAccount = TeamReference & TeamEligibility;

export type LockedTeamGoingWithAccount = TeamGoingWithAccount & { locked: LockedTeam };

/** The teams an account owns alone: those it is the only member of go with it, the others must change hands first. */
export type AccountTeams<Team extends TeamGoingWithAccount = TeamGoingWithAccount> = { goingWithAccount: Team[]; toTransfer: TeamReference[] };

@singleton()
export class AccountTeamsService {
  constructor(
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly teamOrganizationDeletionService: TeamOrganizationDeletionService
  ) {}

  /** Reads the teams as they stand without holding them, for telling the owner what deleting the account takes with it. */
  async assess(ownedTeams: TeamReference[]): Promise<AccountTeams> {
    const teams: AccountTeams = { goingWithAccount: [], toTransfer: [] };

    for (const team of ownedTeams) {
      if (await this.#hasOtherMembers(team.id)) {
        teams.toTransfer.push(team);
      } else {
        teams.goingWithAccount.push({ ...team, ...(await this.teamOrganizationDeletionService.assessUnlocked(team.id)) });
      }
    }

    return teams;
  }

  /** Call it inside the transaction that erases the account, so nobody joins, pays into or deploys from a team between its assessment and its deletion. */
  async lockAndAssess(ownedTeams: TeamReference[]): Promise<AccountTeams<LockedTeamGoingWithAccount>> {
    const teams: AccountTeams<LockedTeamGoingWithAccount> = { goingWithAccount: [], toTransfer: [] };

    for (const team of ownedTeams) {
      const locked = await this.teamOrganizationDeletionService.lockForDeletion(team.id);

      if (!locked) continue;

      if (await this.#hasOtherMembers(team.id)) {
        teams.toTransfer.push(team);
      } else {
        teams.goingWithAccount.push({ ...team, ...(await this.teamOrganizationDeletionService.assess(locked)), locked });
      }
    }

    return teams;
  }

  async eraseWithAccount(teams: LockedTeamGoingWithAccount[], deletedByUserId: string): Promise<void> {
    for (const { locked } of teams) {
      await this.teamOrganizationDeletionService.erase(locked, deletedByUserId);
    }
  }

  async #hasOtherMembers(organizationId: string): Promise<boolean> {
    return (await this.organizationMemberRepository.unscoped("account-deletion").count({ organizationId })) > 1;
  }
}
