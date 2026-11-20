import { type AnyColumn, type SQL, sql } from "drizzle-orm";

import { Templates } from "@src/user/model-schemas/template/template.schema";

/** An imported template is used under its awesome-akash id, as it was before the import, so that history and what follows count as one. */
export function namesTemplateUsage(source: AnyColumn, templateRef: AnyColumn): SQL {
  return sql`(
    ${source} = (case when ${Templates.importedRef} is null then 'console' else 'awesome_akash' end)::template_source
    and ${templateRef} = coalesce(${Templates.importedRef}, ${Templates.id}::text)
  )`;
}

/** A publisher's own usage never counts for its template, except for an imported one: its usage was never held against an organization, and the one it belongs to now is Akash's own. */
export function isCountedForTemplate(usingOrganizationId: AnyColumn): SQL {
  return sql`(${Templates.importedRef} is not null or ${usingOrganizationId} is distinct from ${Templates.organizationId})`;
}
