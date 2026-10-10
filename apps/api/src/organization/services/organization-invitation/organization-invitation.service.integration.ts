import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { JobQueueService } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { OrganizationInvitationRepository } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import type { UserOutput } from "@src/user/repositories";
import {
  INVITATION_LIMIT_REACHED_ERROR_CODE,
  MAX_PENDING_INVITATIONS_PER_ORGANIZATION,
  OrganizationInvitationService
} from "./organization-invitation.service";

import { seedOrganizationInvitation, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(OrganizationInvitationService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createInvitations", () => {
    it("lets only one of two concurrent requests take the organization's last pending invitation", async () => {
      const { service, repository, organization, owner, runAs } = await setup();
      await Promise.all(
        Array.from({ length: MAX_PENDING_INVITATIONS_PER_ORGANIZATION - 1 }, () => seedOrganizationInvitation({ organizationId: organization.id }))
      );

      const outcomes = await Promise.allSettled(
        ["jane@example.com", "joe@example.com"].map(email => runAs(owner, () => service.createInvitations({ emails: [email], role: "member" })))
      );

      expect(outcomes.map(outcome => outcome.status).sort()).toEqual(["fulfilled", "rejected"]);
      expect(outcomes.find(outcome => outcome.status === "rejected")).toMatchObject({
        reason: expect.objectContaining({ status: 403, errorCode: INVITATION_LIMIT_REACHED_ERROR_CODE })
      });
      expect(await repository.countPending(organization.id)).toBe(MAX_PENDING_INVITATIONS_PER_ORGANIZATION);
    });
  });

  async function setup() {
    const service = container.resolve(OrganizationInvitationService);
    const repository = container.resolve(OrganizationInvitationRepository);
    const executionContextService = container.resolve(ExecutionContextService);
    const abilityService = container.resolve(AbilityService);
    vi.spyOn(container.resolve(JobQueueService), "enqueue").mockResolvedValue(null);
    const { organization, user: owner } = await seedOrganizationWithOwner();

    function runAs<R>(user: UserOutput, act: () => Promise<R>) {
      return executionContextService.runWithContext(async () => {
        executionContextService.set("CURRENT_USER", user);
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId: organization.id, role: "owner" }));
        executionContextService.set("ABILITY", abilityService.getAbilityFor("REGULAR_USER", user));

        return await act();
      });
    }

    return { service, repository, organization, owner, runAs };
  }
});
