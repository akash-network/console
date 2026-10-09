import type { MongoAbility, MongoQuery, RawRuleOf } from "@casl/ability";

import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";

export type AbilityRule = RawRuleOf<MongoAbility> & { enabledIf?: FeatureFlagValue };

export type RuleUser = Pick<UserOutput, "id" | "email">;

interface TenantConditions {
  organization: MongoQuery;
  inOrg: MongoQuery;
  inScope: MongoQuery;
  projectsInScope: MongoQuery;
  ownInOrg: MongoQuery;
}

const PROJECT_RESOURCES = ["DeploymentSetting", "Template", "Alert", "NotificationChannel"];

const ROLE_RULES: Record<OrganizationRole, (conditions: TenantConditions, context: OrganizationContext) => AbilityRule[]> = {
  owner: ({ organization, inOrg, inScope }, { organizationType }) => [
    { action: organizationType === "team" ? ["update", "delete"] : "update", subject: "Organization", conditions: organization },
    { action: "manage", subject: ["OrganizationMember", "OrganizationInvitation", "Project", "ProjectMember"], conditions: inOrg },
    { action: "sign", subject: "UserWallet", conditions: inOrg },
    { action: "manage", subject: ["WalletSetting", "PaymentMethod", "StripePayment"], conditions: inOrg },
    { action: "manage", subject: PROJECT_RESOURCES, conditions: inScope }
  ],
  admin: ({ organization, inOrg, inScope }) => [
    { action: "update", subject: "Organization", conditions: organization },
    { action: "manage", subject: ["OrganizationMember", "OrganizationInvitation", "Project", "ProjectMember"], conditions: inOrg },
    { action: "sign", subject: "UserWallet", conditions: inOrg },
    { action: "read", subject: ["WalletSetting", "PaymentMethod", "StripePayment"], conditions: inOrg },
    { action: "manage", subject: PROJECT_RESOURCES, conditions: inScope }
  ],
  member: ({ inOrg, inScope, projectsInScope, ownInOrg }) => [
    { action: "read", subject: "Project", conditions: projectsInScope },
    { action: "read", subject: "ProjectMember", conditions: ownInOrg },
    { action: "sign", subject: "UserWallet", conditions: inOrg },
    { action: "read", subject: "WalletSetting", conditions: inOrg },
    { action: "manage", subject: PROJECT_RESOURCES, conditions: inScope }
  ],
  billing: ({ inOrg }) => [
    { action: "read", subject: "Project", conditions: inOrg },
    { action: "manage", subject: ["WalletSetting", "PaymentMethod", "StripePayment"], conditions: inOrg }
  ],
  viewer: ({ inOrg, inScope, projectsInScope, ownInOrg }) => [
    { action: "read", subject: "Project", conditions: projectsInScope },
    { action: "read", subject: "ProjectMember", conditions: ownInOrg },
    { action: "read", subject: "WalletSetting", conditions: inOrg },
    { action: "read", subject: PROJECT_RESOURCES, conditions: inScope }
  ]
};

export const SUPER_USER_RULES: AbilityRule[] = [{ action: "manage", subject: "all" }];

export function legacyRules(user: RuleUser): AbilityRule[] {
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

function tenantConditionsOf(user: RuleUser, { organizationId, projectScope }: OrganizationContext): TenantConditions {
  const inOrg = { organizationId };
  const projectIds = projectScope.kind === "projects" ? [...projectScope.projectIds] : undefined;

  return {
    organization: { id: organizationId },
    inOrg,
    inScope: projectIds ? { ...inOrg, projectId: { $in: projectIds } } : inOrg,
    projectsInScope: projectIds ? { ...inOrg, id: { $in: projectIds } } : inOrg,
    ownInOrg: { ...inOrg, userId: user.id }
  };
}

function everyMemberRules({ organization, inOrg, ownInOrg }: TenantConditions): AbilityRule[] {
  return [
    { action: "read", subject: "Organization", conditions: organization },
    { action: "read", subject: ["OrganizationMember", "UserWallet"], conditions: inOrg },
    { action: "manage", subject: "ApiKey", conditions: ownInOrg }
  ];
}
