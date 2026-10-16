import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobQueueService } from "@src/core";
import type { Membership, OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { UserOutput } from "@src/user/repositories";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { DepartedMemberAlertsService } from "./departed-member-alerts.service";
import { STOP_TEAM_ALERTS_TO_DEPARTED_MEMBER_RETRY_OPTIONS, StopTeamAlertsToDepartedMember } from "./stop-team-alerts-to-departed-member.handler";

import { createOrganization } from "@test/seeders/organization.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(DepartedMemberAlertsService.name, () => {
  describe("stopTeamAlertsTo", () => {
    it("queues taking the member's lower-cased address off the team's channels, as a digest", async () => {
      const user = createUser({ email: "Jane.Doe@Example.com" });
      const { service, jobQueueService } = setup({ user });

      await service.stopTeamAlertsTo(user.id, "team-1");

      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new StopTeamAlertsToDepartedMember({ organizationId: "team-1", userId: user.id, addressSha256: sha256Of("jane.doe@example.com") }),
        STOP_TEAM_ALERTS_TO_DEPARTED_MEMBER_RETRY_OPTIONS
      );
    });

    it("queues nothing for a member without an email", async () => {
      const user = createUser({ email: null });
      const { service, jobQueueService } = setup({ user });

      await service.stopTeamAlertsTo(user.id, "team-1");

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("queues nothing for a user that is already gone", async () => {
      const { service, jobQueueService } = setup({ user: undefined });

      await service.stopTeamAlertsTo("gone-user", "team-1");

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("stopEveryTeamAlertTo", () => {
    it("queues one release per team the user belongs to and none for their personal organization", async () => {
      const user = createUser();
      const firstTeam = createOrganization({ type: "team" });
      const secondTeam = createOrganization({ type: "team" });
      const { service, jobQueueService, organizationMemberRepository } = setup({
        user,
        memberships: [
          { role: "owner", organization: createOrganization({ type: "personal" }) },
          { role: "member", organization: firstTeam },
          { role: "viewer", organization: secondTeam }
        ]
      });

      await service.stopEveryTeamAlertTo(user.id);

      expect(organizationMemberRepository.findActiveMemberships).toHaveBeenCalledWith(user.id);
      expect(jobQueueService.enqueue.mock.calls.map(([job]) => job.data)).toEqual([
        { organizationId: firstTeam.id, userId: user.id, addressSha256: sha256Of(user.email!.toLowerCase()) },
        { organizationId: secondTeam.id, userId: user.id, addressSha256: sha256Of(user.email!.toLowerCase()) }
      ]);
    });
  });

  function sha256Of(address: string) {
    return createHash("sha256").update(address).digest("hex");
  }

  function setup(input: { user: UserOutput | undefined; memberships?: Membership[] }) {
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(input.user);
    const organizationMemberRepository = mock<OrganizationMemberRepository>();
    organizationMemberRepository.findActiveMemberships.mockResolvedValue(input.memberships ?? []);
    const jobQueueService = mock<JobQueueService>();
    const service = new DepartedMemberAlertsService(userRepository, organizationMemberRepository, jobQueueService);

    return { service, userRepository, organizationMemberRepository, jobQueueService };
  }
});
