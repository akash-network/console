import type { MongoAbility, MongoQuery, RawRuleOf } from "@casl/ability";

import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { type OrganizationRole, organizationRoleEnum } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { OrganizationContext, ProjectScope } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";

export type AbilityRule = RawRuleOf<MongoAbility> & { enabledIf?: FeatureFlagValue };

export type RuleUser = Pick<UserOutput, "id" | "email">;

interface TenantConditions {
  organization: MongoQuery;
  inOrg: MongoQuery;
  belowOwnerInOrg: MongoQuery;
  inScope: MongoQuery;
  projectsInScope: MongoQuery;
  writableInScope: MongoQuery;
  administeredProjects: MongoQuery;
  grantsOfAdministeredProjects: MongoQuery;
  othersGrantsOfAdministeredProjects: MongoQuery;
  administersAnyProject: boolean;
  organizationWide: MongoQuery;
  ownInOrg: MongoQuery;
}

const PROJECT_RESOURCES = ["DeploymentSetting", "Template", "Alert", "NotificationChannel"];

/** An allow-list rather than `$ne: "owner"`, which CASL also matches against a payload that names no role. */
const ROLES_BELOW_OWNER = organizationRoleEnum.enumValues.filter(role => role !== "owner");

const ROLE_RULES: Record<OrganizationRole, (conditions: TenantConditions, context: OrganizationContext) => AbilityRule[]> = {
  owner: ({ organization, inOrg, inScope, writableInScope, grantsOfAdministeredProjects }, { organizationType }) => [
    { action: organizationType === "team" ? ["update", "delete"] : "update", subject: "Organization", conditions: organization },
    { action: "manage", subject: ["OrganizationMember", "OrganizationInvitation", "Project"], conditions: inOrg },
    { action: "manage", subject: "ProjectMember", conditions: grantsOfAdministeredProjects },
    { action: "sign", subject: "UserWallet", conditions: inOrg },
    { action: "manage", subject: ["WalletSetting", "PaymentMethod", "StripePayment"], conditions: inOrg },
    ...projectResourceRules({ inScope, writableInScope })
  ],
  admin: ({ organization, inOrg, belowOwnerInOrg, inScope, writableInScope, grantsOfAdministeredProjects }) => [
    { action: "update", subject: "Organization", conditions: organization },
    { action: "read", subject: "OrganizationInvitation", conditions: inOrg },
    { action: "manage", subject: ["OrganizationMember", "OrganizationInvitation"], conditions: belowOwnerInOrg },
    { action: "manage", subject: "Project", conditions: inOrg },
    { action: "manage", subject: "ProjectMember", conditions: grantsOfAdministeredProjects },
    { action: "sign", subject: "UserWallet", conditions: inOrg },
    { action: "read", subject: ["WalletSetting", "PaymentMethod", "StripePayment"], conditions: inOrg },
    ...projectResourceRules({ inScope, writableInScope })
  ],
  member: conditions => [
    { action: "read", subject: "Project", conditions: conditions.projectsInScope },
    { action: "read", subject: "ProjectMember", conditions: conditions.inScope },
    ...projectAdministrationRules(conditions),
    { action: "sign", subject: "UserWallet", conditions: conditions.inOrg },
    { action: "read", subject: "WalletSetting", conditions: conditions.inOrg },
    ...projectResourceRules(conditions)
  ],
  billing: ({ inOrg }) => [
    { action: "read", subject: "Project", conditions: inOrg },
    { action: "manage", subject: ["WalletSetting", "PaymentMethod", "StripePayment"], conditions: inOrg }
  ],
  viewer: ({ inOrg, inScope, projectsInScope }) => [
    { action: "read", subject: "Project", conditions: projectsInScope },
    { action: "read", subject: "ProjectMember", conditions: inScope },
    { action: "read", subject: "WalletSetting", conditions: inOrg },
    { action: "read", subject: PROJECT_RESOURCES, conditions: inScope }
  ]
};

export const SUPER_USER_RULES: AbilityRule[] = [{ action: "manage", subject: "all" }];

export function legacyRules(user: RuleUser): AbilityRule[] {
  if (!hasEveryId(user.id)) {
    return [];
  }

  return [
    ...userKeyedRules(user),
    { action: ["read", "sign"], subject: "UserWallet", conditions: { userId: user.id } },
    { action: "manage", subject: "WalletSetting", conditions: { userId: user.id } },
    { action: ["create", "read", "delete"], subject: "StripePayment" },
    { action: "manage", subject: "PaymentMethod", conditions: { userId: user.id } },
    { action: "manage", subject: "DeploymentSetting", conditions: { userId: user.id } },
    { action: "manage", subject: "ApiKey", conditions: { userId: user.id } },
    { action: "manage", subject: "Alert", conditions: { userId: user.id } },
    { action: "manage", subject: "NotificationChannel", conditions: { userId: user.id } }
  ];
}

export function organizationRules(user: RuleUser, context: OrganizationContext): AbilityRule[] {
  if (!hasEveryId(user.id, context.organizationId)) {
    return [];
  }

  const conditions = tenantConditionsOf(user, context);

  return [...userKeyedRules(user), ...everyMemberRules(conditions), ...ROLE_RULES[context.role](conditions, context)];
}

export function enabledRules(rules: AbilityRule[], featureFlags: Pick<FeatureFlagsService, "isEnabled">): RawRuleOf<MongoAbility>[] {
  return rules.filter(({ enabledIf }) => !enabledIf || featureFlags.isEnabled(enabledIf)).map(({ enabledIf: _enabledIf, ...rule }) => rule);
}

function userKeyedRules(user: RuleUser): AbilityRule[] {
  return [
    { action: "read", subject: "User", conditions: { id: user.id } },
    { action: "verify-email", subject: "User", conditions: { email: user.email ?? "" } },
    { action: "create", subject: "VerificationEmail", conditions: { id: user.id } },
    { action: "read", subject: "LeaseGpu", conditions: { userId: user.id } },
    { action: "create", subject: "HardwareRequest", conditions: { userId: user.id } },
    { action: ["read", "update"], subject: "Activity", conditions: { userId: user.id } },
    { action: "manage", subject: "FavoriteProvider", conditions: { userId: user.id } },
    { action: "manage", subject: "ConfigureDraft", conditions: { userId: user.id } }
  ];
}

/** CASL matches a condition on an undefined value against every payload lacking that field, so no rule is keyed on a missing id. */
function hasEveryId(...ids: Array<string | null | undefined>) {
  return ids.every(Boolean);
}

function tenantConditionsOf(user: RuleUser, { organizationId, projectScope }: OrganizationContext): TenantConditions {
  const inOrg = { organizationId };
  const listed = (pick: (scope: Extract<ProjectScope, { kind: "projects" }>) => readonly string[]) =>
    projectScope.kind === "projects" ? pick(projectScope).filter(projectId => hasEveryId(projectId)) : undefined;
  const projectIds = listed(scope => scope.projectIds);
  const writableProjectIds = listed(scope => scope.writableProjectIds);
  const adminProjectIds = listed(scope => scope.adminProjectIds);
  const grantsOfAdministeredProjects = adminProjectIds ? { ...inOrg, projectId: { $in: adminProjectIds } } : inOrg;

  return {
    organization: { id: organizationId },
    inOrg,
    belowOwnerInOrg: { ...inOrg, role: { $in: ROLES_BELOW_OWNER } },
    inScope: projectIds ? { ...inOrg, projectId: { $in: projectIds } } : inOrg,
    projectsInScope: projectIds ? { ...inOrg, id: { $in: projectIds } } : inOrg,
    writableInScope: writableProjectIds ? { ...inOrg, projectId: { $in: writableProjectIds } } : inOrg,
    administeredProjects: adminProjectIds ? { ...inOrg, id: { $in: adminProjectIds } } : inOrg,
    grantsOfAdministeredProjects,
    othersGrantsOfAdministeredProjects: { ...grantsOfAdministeredProjects, userId: { $nin: [user.id] } },
    administersAnyProject: !adminProjectIds || adminProjectIds.length > 0,
    organizationWide: { ...inOrg, projectId: null },
    ownInOrg: { ...inOrg, userId: user.id }
  };
}

/** Reading follows every reachable project, writing only the projects the request may change. */
function projectResourceRules({ inScope, writableInScope }: Pick<TenantConditions, "inScope" | "writableInScope">): AbilityRule[] {
  return [
    { action: "read", subject: PROJECT_RESOURCES, conditions: inScope },
    { action: "manage", subject: PROJECT_RESOURCES, conditions: writableInScope }
  ];
}

/** A project admin renames its projects and manages who else reaches them, never its own grant. */
function projectAdministrationRules({ administeredProjects, othersGrantsOfAdministeredProjects, administersAnyProject }: TenantConditions): AbilityRule[] {
  if (!administersAnyProject) return [];

  return [
    { action: "update", subject: "Project", conditions: administeredProjects },
    { action: "manage", subject: "ProjectMember", conditions: othersGrantsOfAdministeredProjects }
  ];
}

function everyMemberRules({ organization, inOrg, inScope, organizationWide, ownInOrg }: TenantConditions): AbilityRule[] {
  return [
    { action: "read", subject: "Organization", conditions: organization },
    { action: "read", subject: ["OrganizationMember", "UserWallet"], conditions: inOrg },
    { action: "read", subject: "OrganizationActivity", conditions: inScope },
    { action: "read", subject: "OrganizationActivity", conditions: organizationWide },
    { action: "manage", subject: "ApiKey", conditions: ownInOrg }
  ];
}
