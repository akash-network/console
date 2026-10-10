import { DrizzleAbility } from "@akashnetwork/drizzle-ability";
import type { MongoAbility } from "@casl/ability";
import { createMongoAbility, subject } from "@casl/ability";
import { faker } from "@faker-js/faker";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { ApiKeys } from "@src/auth/model-schemas";
import { PaymentMethods, StripeTransactions, UserWallets, WalletSetting } from "@src/billing/model-schemas";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentSettings } from "@src/deployment/model-schemas";
import { OrganizationInvitations, OrganizationMembers, Organizations, ProjectMembers, Projects } from "@src/organization/model-schemas";
import type { OrganizationType } from "@src/organization/model-schemas/organization/organization.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { ProjectScope } from "@src/organization/types/organization-context";
import { Templates } from "@src/user/model-schemas";
import { type AbilityRule, enabledRules, legacyRules, ORGANIZATION_LEVEL_SUBJECTS, organizationRules } from "./ability-rules";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

const ACTIONS = ["read", "create", "update", "delete", "sign"];
const MANAGE = ACTIONS;
const READ = ["read"];
const READ_SIGN = ["read", "sign"];
const NONE: string[] = [];
const PROJECT_RESOURCES = ["DeploymentSetting", "Template", "Alert", "NotificationChannel"];

const ORGANIZATION_SUBJECTS = [
  "Organization",
  "OrganizationMember",
  "OrganizationInvitation",
  "Project",
  "ProjectMember",
  "UserWallet",
  "WalletSetting",
  "PaymentMethod",
  "StripePayment",
  ...PROJECT_RESOURCES,
  "ApiKey"
];

const ROLE_TABLE: Record<OrganizationRole, Record<string, string[]>> = {
  owner: {
    Organization: ["read", "update", "delete"],
    OrganizationMember: MANAGE,
    OrganizationInvitation: MANAGE,
    Project: MANAGE,
    ProjectMember: MANAGE,
    UserWallet: READ_SIGN,
    WalletSetting: MANAGE,
    PaymentMethod: MANAGE,
    StripePayment: MANAGE,
    DeploymentSetting: MANAGE,
    Template: MANAGE,
    Alert: MANAGE,
    NotificationChannel: MANAGE,
    ApiKey: MANAGE
  },
  admin: {
    Organization: ["read", "update"],
    OrganizationMember: MANAGE,
    OrganizationInvitation: MANAGE,
    Project: MANAGE,
    ProjectMember: MANAGE,
    UserWallet: READ_SIGN,
    WalletSetting: READ,
    PaymentMethod: READ,
    StripePayment: READ,
    DeploymentSetting: MANAGE,
    Template: MANAGE,
    Alert: MANAGE,
    NotificationChannel: MANAGE,
    ApiKey: MANAGE
  },
  member: {
    Organization: READ,
    OrganizationMember: READ,
    OrganizationInvitation: NONE,
    Project: READ,
    ProjectMember: READ,
    UserWallet: READ_SIGN,
    WalletSetting: READ,
    PaymentMethod: NONE,
    StripePayment: NONE,
    DeploymentSetting: MANAGE,
    Template: MANAGE,
    Alert: MANAGE,
    NotificationChannel: MANAGE,
    ApiKey: MANAGE
  },
  billing: {
    Organization: READ,
    OrganizationMember: READ,
    OrganizationInvitation: NONE,
    Project: READ,
    ProjectMember: NONE,
    UserWallet: READ,
    WalletSetting: MANAGE,
    PaymentMethod: MANAGE,
    StripePayment: MANAGE,
    DeploymentSetting: NONE,
    Template: NONE,
    Alert: NONE,
    NotificationChannel: NONE,
    ApiKey: MANAGE
  },
  viewer: {
    Organization: READ,
    OrganizationMember: READ,
    OrganizationInvitation: NONE,
    Project: READ,
    ProjectMember: READ,
    UserWallet: READ,
    WalletSetting: READ,
    PaymentMethod: NONE,
    StripePayment: NONE,
    DeploymentSetting: READ,
    Template: READ,
    Alert: READ,
    NotificationChannel: READ,
    ApiKey: MANAGE
  }
};

const ROLES = Object.keys(ROLE_TABLE) as OrganizationRole[];

const SUBJECT_TABLES: Record<string, PgTableWithColumns<any>> = {
  Organization: Organizations,
  OrganizationMember: OrganizationMembers,
  OrganizationInvitation: OrganizationInvitations,
  Project: Projects,
  ProjectMember: ProjectMembers,
  UserWallet: UserWallets,
  WalletSetting: WalletSetting,
  PaymentMethod: PaymentMethods,
  StripePayment: StripeTransactions,
  DeploymentSetting: DeploymentSettings,
  Template: Templates,
  ApiKey: ApiKeys
};

describe("ability rules", () => {
  describe(legacyRules.name, () => {
    it("reproduces the rules regular users had before organizations", () => {
      const user = createUser();

      const rules = legacyRules(user);

      expect(rules).toHaveLength(16);
      expect(rules).toEqual(
        expect.arrayContaining([
          { action: ["read", "sign"], subject: "UserWallet", conditions: { userId: user.id } },
          { action: "manage", subject: "WalletSetting", conditions: { userId: user.id } },
          { action: "read", subject: "User", conditions: { id: user.id } },
          { action: "verify-email", subject: "User", conditions: { email: user.email } },
          { action: ["create", "read", "delete"], subject: "StripePayment" },
          { action: "manage", subject: "PaymentMethod", conditions: { userId: user.id } },
          { action: "create", subject: "VerificationEmail", conditions: { id: user.id } },
          { action: "manage", subject: "DeploymentSetting", conditions: { userId: user.id } },
          { action: "read", subject: "LeaseGpu", conditions: { userId: user.id } },
          { action: "manage", subject: "ApiKey", conditions: { userId: user.id } },
          { action: "manage", subject: "Alert", conditions: { userId: user.id } },
          { action: "manage", subject: "NotificationChannel", conditions: { userId: user.id } },
          { action: "create", subject: "HardwareRequest", conditions: { userId: user.id } },
          { action: ["read", "update"], subject: "Activity", conditions: { userId: user.id } },
          { action: "manage", subject: "FavoriteProvider", conditions: { userId: user.id } },
          { action: "manage", subject: "ConfigureDraft", conditions: { userId: user.id } }
        ])
      );
    });

    it("keeps a user without an email from verifying the email of other users without one", () => {
      const user = createUser({ email: null });

      const ability = createMongoAbility(legacyRules(user));

      expect(ability.can("verify-email", subject("User", { email: null }))).toBe(false);
      expect(ability.can("verify-email", subject("User", { email: "" }))).toBe(true);
    });

    it("grants nothing to a user without an id", () => {
      expect(legacyRules(createUser({ id: "" }))).toEqual([]);
    });
  });

  describe(organizationRules.name, () => {
    it.each(ROLES)("grants the %s role exactly its actions on rows inside its scope", role => {
      const { ability, organizationId, grantedProjectId, user } = setup({ role });

      const granted = actionsBySubject(ability, { organizationId, projectId: grantedProjectId, userId: user.id });

      expect(granted).toEqual(ROLE_TABLE[role]);
    });

    it.each(ROLES)("grants the %s role nothing on another organization's rows", role => {
      const { ability, grantedProjectId, user } = setup({ role });

      const granted = actionsBySubject(ability, { organizationId: faker.string.uuid(), projectId: grantedProjectId, userId: user.id });

      expect(granted).toEqual(Object.fromEntries(ORGANIZATION_SUBJECTS.map(subjectType => [subjectType, NONE])));
    });

    it.each(["member", "viewer"] as const)("keeps the %s role out of projects it was not granted", role => {
      const { ability, organizationId, user } = setup({ role });

      const granted = actionsBySubject(ability, { organizationId, projectId: faker.string.uuid(), userId: user.id });

      expect(pick(granted, ["Project", ...PROJECT_RESOURCES])).toEqual({ Project: NONE, DeploymentSetting: NONE, Template: NONE, Alert: NONE, NotificationChannel: NONE });
    });

    it("lets a member granted no projects reach no project resource", () => {
      const { ability, organizationId, user } = setup({ role: "member", projectScope: { kind: "projects", projectIds: [] } });

      const granted = actionsBySubject(ability, { organizationId, projectId: faker.string.uuid(), userId: user.id });
      const unfiled = actionsBySubject(ability, { organizationId, projectId: null, userId: user.id });

      expect(pick(granted, ["Project", ...PROJECT_RESOURCES])).toEqual({ Project: NONE, DeploymentSetting: NONE, Template: NONE, Alert: NONE, NotificationChannel: NONE });
      expect(pick(unfiled, PROJECT_RESOURCES)).toEqual({ DeploymentSetting: NONE, Template: NONE, Alert: NONE, NotificationChannel: NONE });
    });

    it.each(["owner", "admin"] as const)("lets the %s role reach every project of the organization without a grant", role => {
      const { ability, organizationId, user } = setup({ role });

      const granted = actionsBySubject(ability, { organizationId, projectId: faker.string.uuid(), userId: user.id });

      expect(pick(granted, ["Project", ...PROJECT_RESOURCES])).toEqual({ Project: MANAGE, DeploymentSetting: MANAGE, Template: MANAGE, Alert: MANAGE, NotificationChannel: MANAGE });
    });

    it.each(["owner", "admin"] as const)("keeps the %s role to the projects of a narrowed scope", role => {
      const narrowedProjectId = faker.string.uuid();
      const { ability, organizationId, user } = setup({ role, projectScope: { kind: "projects", projectIds: [narrowedProjectId] } });

      const inside = actionsBySubject(ability, { organizationId, projectId: narrowedProjectId, userId: user.id });
      const outside = actionsBySubject(ability, { organizationId, projectId: faker.string.uuid(), userId: user.id });

      expect(pick(inside, PROJECT_RESOURCES)).toEqual({ DeploymentSetting: MANAGE, Template: MANAGE, Alert: MANAGE, NotificationChannel: MANAGE });
      expect(pick(outside, PROJECT_RESOURCES)).toEqual({ DeploymentSetting: NONE, Template: NONE, Alert: NONE, NotificationChannel: NONE });
    });

    it.each(ROLES)("applies the organization rules of the %s role to the Organization subject only", role => {
      const { ability, organizationId, user } = setup({ role });
      const otherSubjects = ORGANIZATION_SUBJECTS.filter(subjectType => subjectType !== "Organization");

      const granted = Object.fromEntries(
        otherSubjects.map(subjectType => [
          subjectType,
          allowedActions(ability, subject(subjectType, { id: organizationId, organizationId: faker.string.uuid(), userId: user.id }))
        ])
      );

      expect(granted).toEqual(Object.fromEntries(otherSubjects.map(subjectType => [subjectType, NONE])));
    });

    it("lets the owner of a personal organization update it but not delete it", () => {
      const { ability, organizationId } = setup({ role: "owner", organizationType: "personal" });

      expect(allowedActions(ability, subject("Organization", { id: organizationId }))).toEqual(["read", "update"]);
    });

    it.each(["OrganizationMember", "OrganizationInvitation"])("lets the admin role read but never write a %s that names the owner role", subjectType => {
      const { ability, organizationId, user } = setup({ role: "admin" });

      expect(allowedActions(ability, subject(subjectType, { organizationId, userId: user.id, role: "owner" }))).toEqual(READ);
    });

    it.each(["OrganizationMember", "OrganizationInvitation"])("lets the admin role write a %s only when it names a role below owner", subjectType => {
      const { ability, organizationId, user } = setup({ role: "admin" });

      expect(allowedActions(ability, subject(subjectType, { organizationId, userId: user.id }))).toEqual(READ);
      expect(allowedActions(ability, subject(subjectType, { organizationId, userId: user.id, role: "billing" }))).toEqual(MANAGE);
    });

    it.each(["OrganizationMember", "OrganizationInvitation"])("lets the owner role manage a %s that names the owner role", subjectType => {
      const { ability, organizationId, user } = setup({ role: "owner" });

      expect(allowedActions(ability, subject(subjectType, { organizationId, userId: user.id, role: "owner" }))).toEqual(MANAGE);
    });

    it("grants nothing for a context without an organization id or a user without an id", () => {
      const { user, context } = setup({ role: "owner" });

      expect(organizationRules(user, { ...context, organizationId: "" })).toEqual([]);
      expect(organizationRules({ ...user, id: "" }, context)).toEqual([]);
    });

    it("ignores blank ids in a project grant list", () => {
      const { ability, organizationId, user } = setup({ role: "member", projectScope: { kind: "projects", projectIds: [""] } });

      expect(pick(actionsBySubject(ability, { organizationId, projectId: "", userId: user.id }), ["Project", ...PROJECT_RESOURCES])).toEqual({
        Project: NONE,
        DeploymentSetting: NONE,
        Template: NONE,
        Alert: NONE,
        NotificationChannel: NONE
      });
    });

    it.each(ROLES)("keeps the API keys of other members out of reach of the %s role", role => {
      const { ability, organizationId } = setup({ role });

      expect(allowedActions(ability, subject("ApiKey", { organizationId, userId: faker.string.uuid() }))).toEqual(NONE);
    });

    it.each(["member", "viewer"] as const)("lets the %s role read only its own project grants", role => {
      const { ability, organizationId, grantedProjectId } = setup({ role });

      expect(allowedActions(ability, subject("ProjectMember", { organizationId, projectId: grantedProjectId, userId: faker.string.uuid() }))).toEqual(NONE);
    });

    it.each(ROLES)("keeps user-keyed subjects on the user id for the %s role", role => {
      const { user, context } = setup({ role });
      const userKeyedSubjects = ["User", "VerificationEmail", "LeaseGpu", "HardwareRequest", "Activity", "FavoriteProvider", "ConfigureDraft"];

      const userKeyedRules = legacyRules(user).filter(rule => userKeyedSubjects.includes(rule.subject as string));

      expect(userKeyedRules).toHaveLength(8);
      expect(organizationRules(user, context)).toEqual(expect.arrayContaining(userKeyedRules));
    });

    it.each(ROLES)("names only columns that exist on each subject's table for the %s role", role => {
      const { ability } = setup({ role, projectScope: { kind: "projects", projectIds: [faker.string.uuid()] } });
      const readableSubjects = Object.keys(SUBJECT_TABLES).filter(subjectType => ability.can("read", subjectType));

      expect(readableSubjects.length).toBeGreaterThan(0);
      readableSubjects.forEach(subjectType => {
        expect(() => new DrizzleAbility(SUBJECT_TABLES[subjectType], ability, "read", subjectType)).not.toThrow();
      });
    });

    describe("for a request made with an API key bound to a project", () => {
      it.each(ROLES)("lets a %s key read the organization and its project but reach no other organization-level subject", role => {
        const projectId = faker.string.uuid();
        const { ability, organizationId, user } = setup({ role, projectScope: { kind: "projects", projectIds: [projectId] }, apiKeyProjectId: projectId });

        const granted = actionsBySubject(ability, { organizationId, projectId, userId: user.id });

        expect(pick(granted, [...ORGANIZATION_LEVEL_SUBJECTS])).toEqual({
          Organization: READ,
          OrganizationMember: NONE,
          OrganizationInvitation: NONE,
          Project: READ,
          ProjectMember: NONE,
          WalletSetting: NONE,
          PaymentMethod: NONE,
          StripePayment: NONE,
          ApiKey: NONE
        });
      });

      it.each(["owner", "admin", "member"] as const)("keeps the project work of a %s key inside its project", role => {
        const projectId = faker.string.uuid();
        const { ability, organizationId, user } = setup({ role, projectScope: { kind: "projects", projectIds: [projectId] }, apiKeyProjectId: projectId });

        const inside = actionsBySubject(ability, { organizationId, projectId, userId: user.id });
        const outside = actionsBySubject(ability, { organizationId, projectId: faker.string.uuid(), userId: user.id });

        expect(pick(inside, ["UserWallet", ...PROJECT_RESOURCES])).toEqual({
          UserWallet: READ_SIGN,
          DeploymentSetting: MANAGE,
          Template: MANAGE,
          Alert: MANAGE,
          NotificationChannel: MANAGE
        });
        expect(pick(outside, ["Project", ...PROJECT_RESOURCES])).toEqual({
          Project: NONE,
          DeploymentSetting: NONE,
          Template: NONE,
          Alert: NONE,
          NotificationChannel: NONE
        });
      });

      it("grants its reads of the organization and its project on those two subjects only", () => {
        const projectId = faker.string.uuid();
        const { ability, organizationId } = setup({ role: "owner", projectScope: { kind: "projects", projectIds: [projectId] }, apiKeyProjectId: projectId });
        const otherSubjects = ORGANIZATION_LEVEL_SUBJECTS.filter(subjectType => subjectType !== "Organization" && subjectType !== "Project");

        const granted = Object.fromEntries(
          otherSubjects.map(subjectType => [
            subjectType,
            [organizationId, projectId].flatMap(id => allowedActions(ability, subject(subjectType, { id, organizationId, userId: faker.string.uuid() })))
          ])
        );

        expect(granted).toEqual(Object.fromEntries(otherSubjects.map(subjectType => [subjectType, NONE])));
      });

      it("keeps every rule it grants tied to at least one subject", () => {
        const projectId = faker.string.uuid();
        const { user, context } = setup({ role: "owner", projectScope: { kind: "projects", projectIds: [projectId] } });

        const rules = organizationRules(user, context, { projectId });

        expect(rules.filter(rule => [rule.subject].flat().length === 0)).toEqual([]);
      });

      it("leaves the rules of a key bound to no project unchanged", () => {
        const { user, context } = setup({ role: "admin" });

        expect(organizationRules(user, context, { projectId: null })).toEqual(organizationRules(user, context));
      });
    });
  });

  describe(enabledRules.name, () => {
    it("applies a feature flag change on the next call", () => {
      const featureFlags = mock<FeatureFlagsService>();
      featureFlags.isEnabled.mockReturnValueOnce(false).mockReturnValueOnce(true);
      const rules: AbilityRule[] = [
        { action: "read", subject: "Alert" },
        { action: "create", subject: "Alert", enabledIf: FeatureFlags.NOTIFICATIONS_ALERT_CREATE }
      ];

      const whileOff = enabledRules(rules, featureFlags);
      const onceOn = enabledRules(rules, featureFlags);

      expect(whileOff).toEqual([{ action: "read", subject: "Alert" }]);
      expect(onceOn).toEqual([
        { action: "read", subject: "Alert" },
        { action: "create", subject: "Alert" }
      ]);
      expect(featureFlags.isEnabled).toHaveBeenCalledTimes(2);
      expect(featureFlags.isEnabled).toHaveBeenCalledWith(FeatureFlags.NOTIFICATIONS_ALERT_CREATE);
    });
  });

  function actionsBySubject(ability: MongoAbility, row: { organizationId: string; projectId: string | null; userId: string }) {
    return Object.fromEntries(ORGANIZATION_SUBJECTS.map(subjectType => [subjectType, allowedActions(ability, rowOf(subjectType, row))]));
  }

  function rowOf(subjectType: string, row: { organizationId: string; projectId: string | null; userId: string }) {
    const idBySubject: Record<string, string | null> = { Organization: row.organizationId, Project: row.projectId };

    return subject(subjectType, { ...row, role: "member", id: idBySubject[subjectType] ?? faker.string.uuid() });
  }

  function allowedActions(ability: MongoAbility, row: ReturnType<typeof subject>) {
    return ACTIONS.filter(action => ability.can(action, row));
  }

  function pick(granted: Record<string, string[]>, subjectTypes: string[]) {
    return Object.fromEntries(subjectTypes.map(subjectType => [subjectType, granted[subjectType]]));
  }

  function setup(input: { role: OrganizationRole; projectScope?: ProjectScope; organizationType?: OrganizationType; apiKeyProjectId?: string }) {
    const user = createUser();
    const grantedProjectId = faker.string.uuid();
    const defaultScopes: Record<OrganizationRole, ProjectScope> = {
      owner: { kind: "all" },
      admin: { kind: "all" },
      member: { kind: "projects", projectIds: [grantedProjectId] },
      billing: { kind: "projects", projectIds: [] },
      viewer: { kind: "projects", projectIds: [grantedProjectId] }
    };
    const context = createOrganizationContext({
      role: input.role,
      organizationType: input.organizationType ?? "team",
      projectScope: input.projectScope ?? defaultScopes[input.role]
    });
    const ability = createMongoAbility(organizationRules(user, context, input.apiKeyProjectId ? { projectId: input.apiKeyProjectId } : undefined));

    return { user, context, ability, organizationId: context.organizationId, grantedProjectId };
  }
});
