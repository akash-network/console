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
import { OrganizationActivities, OrganizationInvitations, OrganizationMembers, Organizations, ProjectMembers, Projects } from "@src/organization/model-schemas";
import type { OrganizationType } from "@src/organization/model-schemas/organization/organization.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { ProjectRole } from "@src/organization/model-schemas/project-member/project-member.schema";
import type { ProjectScope } from "@src/organization/types/organization-context";
import { Templates } from "@src/user/model-schemas";
import { type AbilityRule, enabledRules, legacyRules, organizationRules } from "./ability-rules";

import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";
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
  "ApiKey",
  "OrganizationActivity"
];

const ROLE_TABLE: Record<OrganizationRole, Record<string, string[]>> = {
  owner: {
    Organization: ["read", "update", "delete"],
    OrganizationMember: MANAGE,
    OrganizationInvitation: MANAGE,
    Project: MANAGE,
    ProjectMember: MANAGE,
    OrganizationActivity: READ,
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
    OrganizationActivity: READ,
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
    OrganizationActivity: READ,
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
    OrganizationActivity: NONE,
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
    OrganizationActivity: READ,
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
  ApiKey: ApiKeys,
  OrganizationActivity: OrganizationActivities
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

      expect(pick(granted, ["Project", "ProjectMember", "OrganizationActivity", ...PROJECT_RESOURCES])).toEqual({
        Project: NONE,
        ProjectMember: NONE,
        OrganizationActivity: NONE,
        DeploymentSetting: NONE,
        Template: NONE,
        Alert: NONE,
        NotificationChannel: NONE
      });
    });

    it.each(ROLES)("lets the %s role read the activities about the whole organization", role => {
      const { ability, organizationId, user } = setup({ role, projectScope: createProjectsScope([]) });

      const organizationWide = actionsBySubject(ability, { organizationId, projectId: null, userId: user.id });

      expect(organizationWide.OrganizationActivity).toEqual(READ);
    });

    it("keeps the billing role to the activities about the whole organization", () => {
      const { ability, organizationId, user } = setup({ role: "billing" });

      const granted = actionsBySubject(ability, { organizationId, projectId: faker.string.uuid(), userId: user.id });

      expect(granted.OrganizationActivity).toEqual(NONE);
    });

    it("lets a member granted no projects reach no project resource", () => {
      const { ability, organizationId, user } = setup({ role: "member", projectScope: createProjectsScope([]) });

      const granted = actionsBySubject(ability, { organizationId, projectId: faker.string.uuid(), userId: user.id });
      const unfiled = actionsBySubject(ability, { organizationId, projectId: null, userId: user.id });

      expect(pick(granted, ["Project", ...PROJECT_RESOURCES])).toEqual({
        Project: NONE,
        DeploymentSetting: NONE,
        Template: NONE,
        Alert: NONE,
        NotificationChannel: NONE
      });
      expect(pick(unfiled, PROJECT_RESOURCES)).toEqual({ DeploymentSetting: NONE, Template: NONE, Alert: NONE, NotificationChannel: NONE });
    });

    it.each(["owner", "admin"] as const)("lets the %s role reach every project of the organization without a grant", role => {
      const { ability, organizationId, user } = setup({ role });

      const granted = actionsBySubject(ability, { organizationId, projectId: faker.string.uuid(), userId: user.id });

      expect(pick(granted, ["Project", "ProjectMember", ...PROJECT_RESOURCES])).toEqual({
        Project: MANAGE,
        ProjectMember: MANAGE,
        DeploymentSetting: MANAGE,
        Template: MANAGE,
        Alert: MANAGE,
        NotificationChannel: MANAGE
      });
    });

    it.each(["owner", "admin"] as const)("keeps the %s role to the projects of a narrowed scope", role => {
      const narrowedProjectId = faker.string.uuid();
      const { ability, organizationId, user } = setup({
        role,
        projectScope: createProjectsScope([narrowedProjectId], { adminProjectIds: [narrowedProjectId] })
      });

      const inside = actionsBySubject(ability, { organizationId, projectId: narrowedProjectId, userId: user.id });
      const outside = actionsBySubject(ability, { organizationId, projectId: faker.string.uuid(), userId: user.id });

      expect(pick(inside, ["ProjectMember", ...PROJECT_RESOURCES])).toEqual({
        ProjectMember: MANAGE,
        DeploymentSetting: MANAGE,
        Template: MANAGE,
        Alert: MANAGE,
        NotificationChannel: MANAGE
      });
      expect(pick(outside, ["ProjectMember", ...PROJECT_RESOURCES])).toEqual({
        ProjectMember: NONE,
        DeploymentSetting: NONE,
        Template: NONE,
        Alert: NONE,
        NotificationChannel: NONE
      });
      expect([inside.OrganizationActivity, outside.OrganizationActivity]).toEqual([READ, NONE]);
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
      const { ability, organizationId, user } = setup({ role: "member", projectScope: createProjectsScope([""]) });

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

    it.each(["member", "viewer"] as const)("lets the %s role read who else was granted the projects it reaches", role => {
      const { ability, organizationId, grantedProjectId } = setup({ role });

      expect(allowedActions(ability, subject("ProjectMember", { organizationId, projectId: grantedProjectId, userId: faker.string.uuid() }))).toEqual(READ);
    });

    it.each(ROLES)("keeps user-keyed subjects on the user id for the %s role", role => {
      const { user, context } = setup({ role });
      const userKeyedSubjects = ["User", "VerificationEmail", "LeaseGpu", "HardwareRequest", "Activity", "FavoriteProvider", "ConfigureDraft"];

      const userKeyedRules = legacyRules(user).filter(rule => userKeyedSubjects.includes(rule.subject as string));

      expect(userKeyedRules).toHaveLength(8);
      expect(organizationRules(user, context)).toEqual(expect.arrayContaining(userKeyedRules));
    });

    it.each(ROLES)("names only columns that exist on each subject's table for the %s role", role => {
      const { ability } = setup({ role, projectScope: createProjectsScope([faker.string.uuid()]) });
      const readableSubjects = Object.keys(SUBJECT_TABLES).filter(subjectType => ability.can("read", subjectType));

      expect(readableSubjects.length).toBeGreaterThan(0);
      readableSubjects.forEach(subjectType => {
        expect(() => new DrizzleAbility(SUBJECT_TABLES[subjectType], ability, "read", subjectType)).not.toThrow();
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

  describe("project roles", () => {
    const READ_ONLY_IN_PROJECT = { Project: READ, ProjectMember: READ, DeploymentSetting: READ, Template: READ, Alert: READ, NotificationChannel: READ };

    it.each<[ProjectRole, Record<string, string[]>]>([
      ["viewer", READ_ONLY_IN_PROJECT],
      ["member", { Project: READ, ProjectMember: READ, DeploymentSetting: MANAGE, Template: MANAGE, Alert: MANAGE, NotificationChannel: MANAGE }],
      ["admin", { Project: ["read", "update"], ProjectMember: MANAGE, DeploymentSetting: MANAGE, Template: MANAGE, Alert: MANAGE, NotificationChannel: MANAGE }]
    ])("gives an organization member granted the %s project role these actions in that project", (projectRole, expected) => {
      const projectId = faker.string.uuid();
      const { ability, organizationId } = setup({ role: "member", projectScope: projectRoleScope(projectRole, projectId) });

      const granted = actionsBySubject(ability, { organizationId, projectId, userId: faker.string.uuid() });

      expect(pick(granted, Object.keys(expected))).toEqual(expected);
      expect(pick(granted, ["Organization", "OrganizationMember", "OrganizationInvitation"])).toEqual({
        Organization: READ,
        OrganizationMember: READ,
        OrganizationInvitation: NONE
      });
    });

    it.each<ProjectRole>(["viewer", "member", "admin"])("keeps an organization viewer granted the %s project role to reading", projectRole => {
      const projectId = faker.string.uuid();
      const { ability, organizationId } = setup({ role: "viewer", projectScope: projectRoleScope(projectRole, projectId) });

      const granted = actionsBySubject(ability, { organizationId, projectId, userId: faker.string.uuid() });

      expect(pick(granted, Object.keys(READ_ONLY_IN_PROJECT))).toEqual(READ_ONLY_IN_PROJECT);
    });

    it("keeps a project admin from changing its own grant", () => {
      const projectId = faker.string.uuid();
      const { ability, organizationId, user } = setup({ role: "member", projectScope: projectRoleScope("admin", projectId) });

      expect(allowedActions(ability, subject("ProjectMember", { organizationId, projectId, userId: user.id }))).toEqual(READ);
    });

    it("keeps a project admin's powers to the projects it administers", () => {
      const administered = faker.string.uuid();
      const viewed = faker.string.uuid();
      const { ability, organizationId } = setup({
        role: "member",
        projectScope: createProjectsScope([administered, viewed], { writableProjectIds: [administered], adminProjectIds: [administered] })
      });

      const granted = actionsBySubject(ability, { organizationId, projectId: viewed, userId: faker.string.uuid() });

      expect(pick(granted, Object.keys(READ_ONLY_IN_PROJECT))).toEqual(READ_ONLY_IN_PROJECT);
    });

    it("gives an organization member administering no project no way to manage grants or rename projects", () => {
      const { ability } = setup({ role: "member" });

      expect([ability.can("create", "ProjectMember"), ability.can("update", "Project")]).toEqual([false, false]);
    });

    it.each<OrganizationRole>(["owner", "admin"])("lets the %s manage the grants of every project its request reaches", role => {
      const { ability, organizationId, user } = setup({ role });

      expect(allowedActions(ability, subject("ProjectMember", { organizationId, projectId: faker.string.uuid(), userId: user.id }))).toEqual(MANAGE);
    });

    function projectRoleScope(projectRole: ProjectRole, projectId: string) {
      return createProjectsScope([projectId], {
        writableProjectIds: projectRole === "viewer" ? [] : [projectId],
        adminProjectIds: projectRole === "admin" ? [projectId] : []
      });
    }
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

  function setup(input: { role: OrganizationRole; projectScope?: ProjectScope; organizationType?: OrganizationType }) {
    const user = createUser();
    const grantedProjectId = faker.string.uuid();
    const defaultScopes: Record<OrganizationRole, ProjectScope> = {
      owner: { kind: "all" },
      admin: { kind: "all" },
      member: createProjectsScope([grantedProjectId]),
      billing: createProjectsScope([]),
      viewer: createProjectsScope([grantedProjectId])
    };
    const context = createOrganizationContext({
      role: input.role,
      organizationType: input.organizationType ?? "team",
      projectScope: input.projectScope ?? defaultScopes[input.role]
    });
    const ability = createMongoAbility(organizationRules(user, context));

    return { user, context, ability, organizationId: context.organizationId, grantedProjectId };
  }
});
