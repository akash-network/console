import { subject } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { abilityFor } from "./request-ability";
import type { OrganizationRole, ProjectScope } from "./request-identity";

describe(abilityFor.name, () => {
  describe("without an organization membership", () => {
    it("lets a user manage their own channels and alerts only, even within the same organization", () => {
      const userId = faker.string.uuid();
      const organizationId = faker.string.uuid();
      const ability = abilityFor({ userId, organizationId, projectId: null, membership: null });
      const own = { userId, organizationId };
      const others = { userId: faker.string.uuid(), organizationId };

      expect(ability.can("manage", subject("NotificationChannel", { ...own }))).toBe(true);
      expect(ability.can("delete", subject("Alert", { ...own }))).toBe(true);
      expect(ability.can("manage", subject("DeploymentAlert", { ...own }))).toBe(true);
      expect(ability.can("read", subject("NotificationChannel", { ...others }))).toBe(false);
      expect(ability.can("read", subject("Alert", { ...others }))).toBe(false);
      expect(ability.can("read", subject("DeploymentAlert", { ...others }))).toBe(false);
    });

    it("reaches the user's rows in the minted organization and the unattributed ones, not those of other organizations", () => {
      const userId = faker.string.uuid();
      const ability = abilityFor({ userId, organizationId: faker.string.uuid(), projectId: null, membership: null });
      const unattributed = { userId, organizationId: null };
      const elsewhere = { userId, organizationId: faker.string.uuid() };

      expect(ability.can("update", subject("NotificationChannel", { ...unattributed }))).toBe(true);
      expect(ability.can("read", subject("Alert", { ...unattributed }))).toBe(true);
      expect(ability.can("read", subject("NotificationChannel", { ...elsewhere }))).toBe(false);
      expect(ability.can("read", subject("Alert", { ...elsewhere }))).toBe(false);
      expect(ability.can("read", subject("DeploymentAlert", { ...elsewhere }))).toBe(false);
    });

    it("keeps the rules keyed on the user alone when no organization is minted", () => {
      const userId = faker.string.uuid();
      const ability = abilityFor({ userId, organizationId: null, projectId: null, membership: null });

      expect(ability.can("manage", subject("NotificationChannel", { userId, organizationId: faker.string.uuid() }))).toBe(true);
      expect(ability.can("read", subject("Alert", { userId: faker.string.uuid() }))).toBe(false);
    });

    it("limits alert updates to the editable fields", () => {
      const userId = faker.string.uuid();
      const ability = abilityFor({ userId, organizationId: null, projectId: null, membership: null });

      expect(ability.can("update", subject("Alert", { userId }), "enabled")).toBe(true);
      expect(ability.can("update", subject("Alert", { userId }), "userId")).toBe(false);
    });
  });

  describe("with an organization membership", () => {
    it.each(["owner", "admin"] as const)("lets %s manage every channel of the organization", role => {
      const { ability, organizationId } = setup({ role, scope: "granted" });

      expect(ability.can("update", subject("NotificationChannel", { organizationId, userId: faker.string.uuid() }))).toBe(true);
      expect(ability.can("delete", subject("NotificationChannel", { organizationId, userId: faker.string.uuid() }))).toBe(true);
    });

    it("keeps a member from changing the organization's default channel even when they created it", () => {
      const { ability, organizationId, userId } = setup({ role: "member", scope: "granted" });
      const defaultChannel = { organizationId, userId, isDefault: true };

      expect(ability.can("read", subject("NotificationChannel", { ...defaultChannel }))).toBe(true);
      expect(ability.can("update", subject("NotificationChannel", { ...defaultChannel }))).toBe(false);
      expect(ability.can("delete", subject("NotificationChannel", { ...defaultChannel }))).toBe(false);
      expect(ability.can("create", subject("NotificationChannel", { ...defaultChannel }))).toBe(true);
    });

    it.each(["owner", "admin"] as const)("lets %s change the organization's default channel", role => {
      const { ability, organizationId } = setup({ role, scope: "granted" });

      expect(ability.can("update", subject("NotificationChannel", { organizationId, userId: faker.string.uuid(), isDefault: true }))).toBe(true);
    });

    it("lets a member read every channel of the organization and change only their own", () => {
      const { ability, organizationId, userId } = setup({ role: "member", scope: "granted" });
      const othersChannel = { organizationId, userId: faker.string.uuid() };
      const ownChannel = { organizationId, userId };

      expect(ability.can("read", subject("NotificationChannel", { ...othersChannel }))).toBe(true);
      expect(ability.can("update", subject("NotificationChannel", { ...othersChannel }))).toBe(false);
      expect(ability.can("delete", subject("NotificationChannel", { ...othersChannel }))).toBe(false);
      expect(ability.can("create", subject("NotificationChannel", { ...ownChannel }))).toBe(true);
      expect(ability.can("update", subject("NotificationChannel", { ...ownChannel }))).toBe(true);
      expect(ability.can("create", subject("NotificationChannel", { organizationId: faker.string.uuid(), userId }))).toBe(false);
    });

    it.each(["owner", "admin", "member"] as const)("lets %s manage alerts in reach", role => {
      const { ability, organizationId, grantedProjectId } = setup({ role, scope: "granted" });

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

    it.each(["member", "viewer"] as const)("gives a %s without granted projects no alert at all", role => {
      const { ability, organizationId } = setup({ role, scope: "none" });

      for (const projectId of [faker.string.uuid(), null]) {
        expect(ability.can("read", subject("Alert", { organizationId, projectId }))).toBe(false);
        expect(ability.can("read", subject("DeploymentAlert", { organizationId, projectId }))).toBe(false);
        expect(ability.can("create", subject("Alert", { organizationId, projectId }))).toBe(false);
      }
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

    it.each(["all", "granted"] as const)("gives billing no access to channels or alerts whatever its scope (%s)", scope => {
      const { ability, organizationId, grantedProjectId, userId } = setup({ role: "billing", scope });

      for (const action of ["read", "create", "update", "delete"]) {
        expect(ability.can(action, subject("NotificationChannel", { organizationId, userId }))).toBe(false);
        expect(ability.can(action, subject("Alert", { organizationId, projectId: grantedProjectId, userId }))).toBe(false);
        expect(ability.can(action, subject("DeploymentAlert", { organizationId, projectId: grantedProjectId, userId }))).toBe(false);
      }
    });
  });

  function setup(input: { role: OrganizationRole; scope: "all" | "granted" | "none" }) {
    const userId = faker.string.uuid();
    const organizationId = faker.string.uuid();
    const grantedProjectId = faker.string.uuid();
    const projectScopes: Record<typeof input.scope, ProjectScope> = {
      all: { kind: "all" },
      granted: { kind: "projects", projectIds: [grantedProjectId] },
      none: { kind: "projects", projectIds: [] }
    };
    const ability = abilityFor({
      userId,
      organizationId,
      projectId: null,
      membership: { organizationId, role: input.role, projectScope: projectScopes[input.scope] }
    });

    return { ability, organizationId, grantedProjectId, userId };
  }
});
