import { type AnyAbility, subject } from "@casl/ability";

export type TemplateWriteAction = "update" | "delete";

export type TemplateWriteRefusal = "outside_active_organization" | "not_permitted";

type OrganizationFiled = { organizationId?: string | null };

type WriteAccess = { ability: AnyAbility; activeOrganizationId: string | undefined };

export function isInActiveOrganization(template: OrganizationFiled, activeOrganizationId: string | undefined): boolean {
  return !!activeOrganizationId && template.organizationId === activeOrganizationId;
}

/** A write acts only on a template of the active organization, which keeps the legacy author rule from reaching a team template from outside it. */
export function findTemplateWriteRefusal<T extends OrganizationFiled>(
  template: T,
  action: TemplateWriteAction,
  { ability, activeOrganizationId }: WriteAccess
): TemplateWriteRefusal | undefined {
  if (!isInActiveOrganization(template, activeOrganizationId)) return "outside_active_organization";
  if (!ability.can(action, subject("Template", { ...template }))) return "not_permitted";

  return undefined;
}
