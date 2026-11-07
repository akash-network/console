import { type AnyAbility, subject } from "@casl/ability";

export type TemplateWriteAction = "update" | "delete";

export type TemplateWriteRefusal = "outside_active_organization" | "not_permitted";

type WriteAccess = { ability: AnyAbility; activeOrganizationId: string | undefined };

/** A write acts only on a template of the active organization, which keeps the legacy author rule from reaching a team template from outside it. */
export function findTemplateWriteRefusal<T extends { organizationId: string | null }>(
  template: T,
  action: TemplateWriteAction,
  { ability, activeOrganizationId }: WriteAccess
): TemplateWriteRefusal | undefined {
  if (template.organizationId !== activeOrganizationId) return "outside_active_organization";
  if (!ability.can(action, subject("Template", { ...template }))) return "not_permitted";

  return undefined;
}
