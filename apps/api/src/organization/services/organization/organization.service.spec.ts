import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { Membership, OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { OrganizationService } from "./organization.service";

import { createApiKey } from "@test/seeders/api-key.seeder";
import { createOrganization } from "@test/seeders/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(OrganizationService.name, () => {
  describe("listCallerMemberships", () => {
    it("lists every membership of a signed-in caller and marks the active one", async () => {
      const { service, personal, team, organizationMemberRepository, user } = setup({});

      const memberships = await service.listCallerMemberships();

      expect(organizationMemberRepository.findActiveMemberships).toHaveBeenCalledWith(user.id);
      expect(memberships).toEqual([
        { ...personal, isActive: false },
        { ...team, isActive: true }
      ]);
    });

    it("lists only the organization an API key acts in", async () => {
      const { service, team } = setup({ apiKey: createApiKey({ organizationId: null }) });

      const memberships = await service.listCallerMemberships();

      expect(memberships).toEqual([{ ...team, isActive: true }]);
    });
  });

  function setup(input: { apiKey?: ApiKeyOutput }) {
    const user = createUser();
    const personal: Membership = { role: "owner", organization: createOrganization({ type: "personal" }) };
    const team: Membership = { role: "admin", organization: createOrganization({ type: "team" }) };
    const organizationContext = createOrganizationContext({ organizationId: team.organization.id });
    const authService = mock<AuthService>({ currentUser: user });
    const organizationMemberRepository = mock<OrganizationMemberRepository>({ findActiveMemberships: vi.fn().mockResolvedValue([personal, team]) });
    const storage: Record<string, unknown> = { ORGANIZATION_CONTEXT: organizationContext, CURRENT_API_KEY: input.apiKey };
    const executionContextService = mock<ExecutionContextService>({ get: vi.fn().mockImplementation(key => storage[key]) });
    const service = new OrganizationService(authService, organizationMemberRepository, executionContextService);

    return { service, personal, team, organizationMemberRepository, user };
  }
});
