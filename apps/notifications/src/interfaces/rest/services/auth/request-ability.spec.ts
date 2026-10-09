import { subject } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { abilityFor } from "./request-ability";
import type { OrganizationRole, ProjectScope } from "./request-identity";

describe(abilityFor.name, () => {
  describe("without an organization membership", () => {
    it("lets a user manage their own channels and alerts only", () => {
      const userId = faker.string.uuid();
      const ability = abilityFor({ userId, organizationId: faker.string.uuid(), projectId: null, membership: null });
      const own = { userId };
      const others = { userId: faker.string.uuid() };

      expect(ability.can("manage", subject("NotificationChannel", { ...own }))).toBe(true);
      expect(ability.can("delete", subject("Alert", { ...own }))).toBe(true);
      expect(ability.can("manage", subject("DeploymentAlert", { ...own }))).toBe(true);
      expect(ability.can("read", subject("NotificationChannel", { ...others }))).toBe(false);
      expect(ability.can("read", subject("Alert", { ...others }))).toBe(false);
      expect(ability.can("read", subject("DeploymentAlert", { ...others }))).toBe(false);
    });

    it("limits alert updates to the editable fields", () => {
      const userId = faker.string.uuid();
      const ability = abilityFor({ userId, organizationId: null, projectId: null, membership: null });

      expect(ability.can("update", subject("Alert", { userId }), "enabled")).toBe(true);
      expect(ability.can("update", subject("Alert", { userId }), "userId")).toBe(false);
    });
  });

  describe("with an organization membership", () => {
    it.each(["owner", "admin", "member"] as const)("lets %s manage channels of the organization and alerts in reach", role => {
      const { ability, organizationId, grantedProjectId } = setup({ role, scope: "granted" });

      expect(ability.can("manage", subject("NotificationChannel", { organizationId, userId: faker.string.uuid() }))).toBe(true);
      expect(ability.can("create", subject("Alert", { organizationId, projectId: grantedProjectId }))).toBe(true);
      expect(ability.can("delete", subject("Alert", { organizationId, projectId: grantedProjectId }))).toBe(true);
      expect(ability.can("update", subject("Alert", { organizationId, projectId: grantedProjectId }), "conditions")).toBe(true);
      expect(ability.can("update", subject("Alert", { organizationId, projectId: grantedProjectId }), "projectId")).toBe(false);
      expect(ability.can("manage", subject("DeploymentAlert", { organizationId, projectId: grantedProjectId }))).toBe(true);
    });

    it("keeps alerts of projects outside the scope out of reach", () => {
      const { ability, organizationId } = setup({ role: "member", scope: "granted" });

      expect(ability.can("read", subject("Alert", { organizationId, projectId: faker.string.uuid() }))).toBe(false);
      expect(ability.can("read", subject("Alert", { organizationId, projectId: null }))).toBe(false);
      expect(ability.can("read", subject("DeploymentAlert", { organizationId, projectId: faker.string.uuid() }))).toBe(false);
    });

    it("reaches every project of the organization with an unrestricted scope", () => {
      const { ability, organizationId } = setup({ role: "admin", scope: "all" });

      expect(ability.can("manage", subject("DeploymentAlert", { organizationId, projectId: faker.string.uuid() }))).toBe(true);
      expect(ability.can("delete", subject("Alert", { organizationId, projectId: null }))).toBe(true);
    });

    it("keeps other organizations out of reach whatever the role", () => {
      const { ability, grantedProjectId } = setup({ role: "owner", scope: "all" });
      const otherOrganizationId = faker.string.uuid();

      expect(ability.can("read", subject("NotificationChannel", { organizationId: otherOrganizationId }))).toBe(false);
      expect(ability.can("read", subject("Alert", { organizationId: otherOrganizationId, projectId: grantedProjectId }))).toBe(false);
    });

    it("lets a viewer read channels and alerts in reach without changing them", () => {
      const { ability, organizationId, grantedProjectId } = setup({ role: "viewer", scope: "granted" });
      const alert = { organizationId, projectId: grantedProjectId };

      expect(ability.can("read", subject("NotificationChannel", { organizationId }))).toBe(true);
      expect(ability.can("read", subject("Alert", { ...alert }))).toBe(true);
      expect(ability.can("read", subject("DeploymentAlert", { ...alert }))).toBe(true);
      expect(ability.can("create", subject("NotificationChannel", { organizationId }))).toBe(false);
      expect(ability.can("create", subject("Alert", { ...alert }))).toBe(false);
      expect(ability.can("update", subject("DeploymentAlert", { ...alert }))).toBe(false);
    });

    it("gives billing no access to channels or alerts", () => {
      const { ability } = setup({ role: "billing", scope: "granted" });

      expect(ability.can("read", "NotificationChannel")).toBe(false);
      expect(ability.can("read", "Alert")).toBe(false);
      expect(ability.can("read", "DeploymentAlert")).toBe(false);
    });
  });

  function setup(input: { role: OrganizationRole; scope: "all" | "granted" }) {
    const organizationId = faker.string.uuid();
    const grantedProjectId = faker.string.uuid();
    const projectScope: ProjectScope = input.scope === "all" ? { kind: "all" } : { kind: "projects", projectIds: [grantedProjectId] };
    const ability = abilityFor({
      userId: faker.string.uuid(),
      organizationId,
      projectId: null,
      membership: { organizationId, role: input.role, projectScope }
    });

    return { ability, organizationId, grantedProjectId };
  }
});
