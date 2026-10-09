import { subject } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { AbilityService } from "./ability.service";
import { legacyRules, organizationRules } from "./ability-rules";
import { ShadowedAbility } from "./shadowed-ability";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(AbilityService.name, () => {
  describe("getAbilityFor", () => {
    it("builds today's rules when the request has no organization context", () => {
      const { service, user } = setup();

      const ability = service.getAbilityFor("REGULAR_USER", user);

      expect(ability.rules).toEqual(legacyRules(user));
      expect(ability).not.toBeInstanceOf(ShadowedAbility);
    });

    it("builds today's rules outside any execution context", () => {
      const { service, user, executionContextService } = setup({ hasContext: false });

      const ability = service.getAbilityFor("REGULAR_PAYING_USER", user);

      expect(ability.rules).toEqual(legacyRules(user));
      expect(executionContextService.get).not.toHaveBeenCalled();
    });

    it("grants a super user everything whatever the organization context", () => {
      const { service, user } = setup({ organizationContext: createOrganizationContext({ role: "viewer" }) });

      const ability = service.getAbilityFor("SUPER_USER", user);

      expect(ability.rules).toEqual([{ action: "manage", subject: "all" }]);
    });

    it.each([
      { mode: "no organization context", organizationContext: undefined },
      { mode: "legacy mode", organizationContext: createOrganizationContext({ mode: "legacy" }) },
      { mode: "organization mode", organizationContext: createOrganizationContext({ mode: "organization" }) }
    ])("accepts a user whose email contains a double quote in $mode", ({ organizationContext }) => {
      const email = `jane"doe${faker.number.int()}@example.com`;
      const { service } = setup({ organizationContext });

      const ability = service.getAbilityFor("REGULAR_USER", createUser({ email }));

      expect(ability.can("verify-email", subject("User", { email }))).toBe(true);
    });

    it("uses only the organization rules in organization mode", () => {
      const organizationContext = createOrganizationContext({ mode: "organization", role: "member", projectScope: { kind: "projects", projectIds: [] } });
      const { service, user, logger } = setup({ organizationContext });

      const ability = service.getAbilityFor("REGULAR_USER", user);

      expect(ability.rules).toEqual(organizationRules(user, organizationContext));
      expect(ability.can("read", subject("DeploymentSetting", { userId: user.id, organizationId: null }))).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("keeps today's rules authoritative in legacy mode and reports where the organization rules disagree", () => {
      const organizationContext = createOrganizationContext({ mode: "legacy", role: "owner", organizationType: "personal" });
      const { service, user, logger } = setup({ organizationContext });

      const ability = service.getAbilityFor("REGULAR_USER", user);
      const allowed = ability.can("read", subject("DeploymentSetting", { userId: user.id, organizationId: null }));

      expect(ability).toBeInstanceOf(ShadowedAbility);
      expect(ability.rules).toEqual(legacyRules(user));
      expect(allowed).toBe(true);
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith({
        event: "ORGANIZATION_ABILITY_SHADOW_MISMATCH",
        action: "read",
        subjectType: "DeploymentSetting",
        allowedBy: "legacy"
      });
    });

    it("compares legacy mode checks against the organization rules of the request", () => {
      const organizationContext = createOrganizationContext({ mode: "legacy", role: "viewer", projectScope: { kind: "projects", projectIds: [] } });
      const { service, user, logger } = setup({ organizationContext });

      const ability = service.getAbilityFor("REGULAR_USER", user);
      ability.can("read", subject("DeploymentSetting", { userId: user.id, organizationId: organizationContext.organizationId, projectId: faker.string.uuid() }));

      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ allowedBy: "legacy" }));
    });

    it("rebuilds the rules on every call so a mode change applies to the next request", () => {
      const legacyContext = createOrganizationContext({ mode: "legacy" });
      const organizationContext: OrganizationContext = { ...legacyContext, mode: "organization" };
      const { service, user, executionContextService } = setup({ organizationContext: legacyContext });

      const before = service.getAbilityFor("REGULAR_USER", user);
      executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(organizationContext);
      const after = service.getAbilityFor("REGULAR_USER", user);

      expect(before.rules).toEqual(legacyRules(user));
      expect(after.rules).toEqual(organizationRules(user, organizationContext));
    });
  });

  it("names its logger after itself", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: AbilityService.name });
  });

  function setup(input: { organizationContext?: OrganizationContext; hasContext?: boolean } = {}) {
    const user = createUser();
    const featureFlagsService = mock<FeatureFlagsService>();
    const executionContextService = mock<ExecutionContextService>({ hasContext: vi.fn(() => input.hasContext ?? true) });
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(input.organizationContext);
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new AbilityService(featureFlagsService, executionContextService, createLogger);

    return { service, user, featureFlagsService, executionContextService, logger, createLogger };
  }
});
