import { subject } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { AbilityService } from "./ability.service";
import { enabledRules, organizationRules } from "./ability-rules";

import { createApiKey } from "@test/seeders/api-key.seeder";
import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(AbilityService.name, () => {
  describe("getAbilityFor", () => {
    it("grants nothing when the request has no organization context", () => {
      const { service, user } = setup();

      const ability = service.getAbilityFor("REGULAR_USER", user);

      expect(ability.rules).toEqual([]);
    });

    it("grants nothing outside any execution context", () => {
      const { service, user, executionContextService } = setup({ hasContext: false });

      const ability = service.getAbilityFor("REGULAR_PAYING_USER", user);

      expect(ability.rules).toEqual([]);
      expect(executionContextService.get).not.toHaveBeenCalled();
    });

    it("grants a super user everything whatever the organization context", () => {
      const { service, user } = setup({ organizationContext: createOrganizationContext({ role: "viewer" }) });

      const ability = service.getAbilityFor("SUPER_USER", user);

      expect(ability.rules).toEqual([{ action: "manage", subject: "all" }]);
    });

    it("uses the organization rules of the request", () => {
      const organizationContext = createOrganizationContext({ role: "member", projectScope: createProjectsScope([]) });
      const { service, user, featureFlagsService } = setup({ organizationContext });

      const ability = service.getAbilityFor("REGULAR_USER", user);

      expect(ability.rules).toEqual(enabledRules(organizationRules(user, organizationContext), featureFlagsService));
      expect(ability.can("read", subject("DeploymentSetting", { userId: user.id, organizationId: null }))).toBe(false);
    });

    it("builds the organization rules for the API key the request authenticated with", () => {
      const projectId = faker.string.uuid();
      const organizationContext = createOrganizationContext({ role: "admin", projectScope: createProjectsScope([projectId]) });
      const { service, user, executionContextService, featureFlagsService } = setup({ organizationContext });
      const apiKey = createApiKey({ userId: user.id, organizationId: organizationContext.organizationId, projectId });
      executionContextService.get.calledWith("CURRENT_API_KEY").mockReturnValue(apiKey);

      const ability = service.getAbilityFor("REGULAR_USER", user);

      expect(ability.rules).toEqual(enabledRules(organizationRules(user, organizationContext, apiKey), featureFlagsService));
      expect(ability.can("read", subject("ApiKey", { userId: user.id, organizationId: organizationContext.organizationId }))).toBe(false);
    });

    it("fails when the organization rules cannot be built", () => {
      const { service, user } = setup({ organizationContext: createOrganizationContext({ role: unknownRole() }) });

      expect(() => service.getAbilityFor("REGULAR_USER", user)).toThrow(TypeError);
    });

    it("rebuilds the rules on every call so a context change applies to the next request", () => {
      const ownerContext = createOrganizationContext({ role: "owner" });
      const viewerContext: OrganizationContext = { ...ownerContext, role: "viewer" };
      const { service, user, executionContextService, featureFlagsService } = setup({ organizationContext: ownerContext });

      const before = service.getAbilityFor("REGULAR_USER", user);
      executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(viewerContext);
      const after = service.getAbilityFor("REGULAR_USER", user);

      expect(before.rules).toEqual(enabledRules(organizationRules(user, ownerContext), featureFlagsService));
      expect(after.rules).toEqual(enabledRules(organizationRules(user, viewerContext), featureFlagsService));
    });
  });

  function unknownRole() {
    const role: string = "auditor";
    return role as OrganizationRole;
  }

  function setup(input: { organizationContext?: OrganizationContext; hasContext?: boolean } = {}) {
    const user = createUser();
    const featureFlagsService = mock<FeatureFlagsService>();
    const executionContextService = mock<ExecutionContextService>({ hasContext: vi.fn(() => input.hasContext ?? true) });
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(input.organizationContext);
    const service = new AbilityService(featureFlagsService, executionContextService);

    return { service, user, featureFlagsService, executionContextService };
  }
});
