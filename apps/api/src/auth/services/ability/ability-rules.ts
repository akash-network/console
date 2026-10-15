import type { MongoAbility, MongoQuery, RawRuleOf } from "@casl/ability";

import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { type OrganizationRole, organizationRoleEnum } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { OrganizationContext, ProjectScope } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";

export type AbilityRule = RawRuleOf<MongoAbility> & { enabledIf?: FeatureFlagValue };

export type RuleUser = Pick<UserOutput, "id" | "email" | "userId">;

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

/** A project-bound API key keeps no rule on these beyond reading its organization and its project. */
export const ORGANIZATION_LEVEL_SUBJECTS: readonly string[] = [
  "Organization",
  "OrganizationMember",
  "OrganizationInvitation",
  "Project",
  "ProjectMember",
  "WalletSetting",
  "PaymentMethod",
  "StripePayment",
  "ApiKey"
];

/** An allow-list rather than `$ne: "owner"`, which CASL also matches against a payload that names no role. */
const ROLES_BELOW_OWNER = organizationRoleEnum.enumValues.filter(role => role !== "owner");

const ROLE_RULES: Record<OrganizationRole, (conditions: TenantConditions, context: OrganizationContext) => AbilityRule[]> = {
  owner: ({ organization, inOrg, inScope, writableInScope, grantsOfAdministeredProjects }, { organizationType, projectScope }) => [
    { action: organizationType === "team" ? ["update", "delete"] : "update", subject: "Organization", conditions: organization },
    ...organizationSpendRules(inOrg, projectScope),
    { action: "manage", subject: ["OrganizationMember", "OrganizationInvitation", "Project"], conditions: inOrg },
    { action: "manage", subject: "ProjectBudget", conditions: inScope },
    { action: "manage", subject: "ProjectMember", conditions: grantsOfAdministeredProjects },
    { action: "sign", subject: "UserWallet", conditions: inOrg },
    { action: "manage", subject: ["WalletSetting", "PaymentMethod", "StripePayment"], conditions: inOrg },
    ...projectResourceRules({ inScope, writableInScope })
  ],
  admin: ({ organization, inOrg, belowOwnerInOrg, inScope, writableInScope, grantsOfAdministeredProjects }, { projectScope }) => [
    { action: "update", subject: "Organization", conditions: organization },
    ...organizationSpendRules(inOrg, projectScope),
    { action: "read", subject: "OrganizationInvitation", conditions: inOrg },
    { action: "manage", subject: ["OrganizationMember", "OrganizationInvitation"], conditions: belowOwnerInOrg },
    { action: "manage", subject: "Project", conditions: inOrg },
    { action: "manage", subject: "ProjectBudget", conditions: inScope },
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

/** Reads across every project, which a project-bound key does not inherit from its owner's role. */
const ORGANIZATION_WIDE_ROLE_RULES: Partial<Record<OrganizationRole, (conditions: TenantConditions) => AbilityRule[]>> = {
  billing: ({ inOrg }) => [{ action: "read", subject: ["ProjectSpend", "OrganizationSpend", "ProjectBudget"], conditions: inOrg }]
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
    { action: "manage", subject: "NotificationChannel", conditions: { userId: user.id } },
    ...authoredTemplateRules(user)
  ];
}

/** Templates name their author by the Auth0 subject rather than the user id. */
function authoredTemplateRules({ userId }: RuleUser): AbilityRule[] {
  return hasEveryId(userId) ? [{ action: "manage", subject: "Template", conditions: { userId } }] : [];
}

export function organizationRules(user: RuleUser, context: OrganizationContext, apiKey?: Pick<ApiKeyOutput, "projectId">): AbilityRule[] {
  if (!hasEveryId(user.id, context.organizationId)) {
    return [];
  }

  const conditions = tenantConditionsOf(user, context);
  const rules = [...userKeyedRules(user), ...everyMemberRules(conditions), ...ROLE_RULES[context.role](conditions, context)];

  return apiKey?.projectId
    ? [...withoutOrganizationLevelSubjects(rules), ...projectBoundKeyRules(conditions)]
    : [...rules, ...organizationWideRules(conditions, context)];
}

function withoutOrganizationLevelSubjects(rules: AbilityRule[]): AbilityRule[] {
  return rules.flatMap(rule => {
    const subjects = [rule.subject].flat().filter(subjectType => !ORGANIZATION_LEVEL_SUBJECTS.includes(subjectType as string));

    return subjects.length ? [{ ...rule, subject: subjects }] : [];
  });
}

/** Activity outside any project, such as members joining, stays out of a project-bound key's reach like the members themselves. */
function organizationWideRules(conditions: TenantConditions, { role }: OrganizationContext): AbilityRule[] {
  return [
    { action: "read", subject: "OrganizationActivity", conditions: conditions.organizationWide },
    ...(ORGANIZATION_WIDE_ROLE_RULES[role]?.(conditions) ?? [])
  ];
}

function projectBoundKeyRules({ organization, projectsInScope }: TenantConditions): AbilityRule[] {
  return [
    { action: "read", subject: "Organization", conditions: organization },
    { action: "read", subject: "Project", conditions: projectsInScope }
  ];
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
  const writableProjectIds = listed(scope => scope.writableProjectIds)?.filter(projectId => projectIds?.includes(projectId));
  const adminProjectIds = listed(scope => scope.adminProjectIds)?.filter(projectId => writableProjectIds?.includes(projectId));
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

function projectResourceRules({ inScope, writableInScope }: Pick<TenantConditions, "inScope" | "writableInScope">): AbilityRule[] {
  return [
    { action: "read", subject: PROJECT_RESOURCES, conditions: inScope },
    { action: "manage", subject: PROJECT_RESOURCES, conditions: writableInScope }
  ];
}

function projectAdministrationRules({
  administeredProjects,
  grantsOfAdministeredProjects,
  othersGrantsOfAdministeredProjects,
  administersAnyProject
}: TenantConditions): AbilityRule[] {
  if (!administersAnyProject) return [];

  return [
    { action: "update", subject: "Project", conditions: administeredProjects },
    { action: "read", subject: "ProjectBudget", conditions: grantsOfAdministeredProjects },
    { action: "manage", subject: "ProjectMember", conditions: othersGrantsOfAdministeredProjects }
  ];
}

function everyMemberRules({ organization, inOrg, inScope, ownInOrg }: TenantConditions): AbilityRule[] {
  return [
    { action: "read", subject: "Organization", conditions: organization },
    { action: "read", subject: ["OrganizationMember", "UserWallet"], conditions: inOrg },
    { action: "read", subject: "OrganizationActivity", conditions: inScope },
    { action: "read", subject: "ProjectSpend", conditions: inScope },
    { action: "manage", subject: "ApiKey", conditions: ownInOrg }
  ];
}

/** Organization-wide totals would show spend beyond the projects a narrowed request is limited to. */
function organizationSpendRules(inOrg: MongoQuery, projectScope: ProjectScope): AbilityRule[] {
  return projectScope.kind === "all" ? [{ action: "read", subject: "OrganizationSpend", conditions: inOrg }] : [];
}
