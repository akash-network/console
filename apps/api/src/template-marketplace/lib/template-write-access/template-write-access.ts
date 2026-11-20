import { type AnyAbility, subject } from "@casl/ability";

export type TemplateWriteAction = "update" | "delete";

export type TemplateWriteRefusal = "imported_read_only" | "outside_active_organization" | "not_permitted";

type OrganizationFiled = { organizationId?: string | null; importedRef?: string | null };

type WriteAccess = { ability: AnyAbility; activeOrganizationId: string | undefined };

export function isInActiveOrganization(template: OrganizationFiled, activeOrganizationId: string | undefined): boolean {
  return !!activeOrganizationId && template.organizationId === activeOrganizationId;
}

/** A write acts only on a template of the active organization, which keeps the legacy author rule from reaching a team template from outside it; a template the awesome-akash import owns is refused first and to everyone, since GitHub is where it changes. */
export function findTemplateWriteRefusal<T extends OrganizationFiled>(
  template: T,
  action: TemplateWriteAction,
  { ability, activeOrganizationId }: WriteAccess
): TemplateWriteRefusal | undefined {
  if (template.importedRef) return "imported_read_only";
  if (!isInActiveOrganization(template, activeOrganizationId)) return "outside_active_organization";
  if (!ability.can(action, subject("Template", { ...template }))) return "not_permitted";

  return undefined;
}
