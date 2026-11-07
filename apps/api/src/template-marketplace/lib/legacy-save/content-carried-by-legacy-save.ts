import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { findAskedValueIssues } from "@src/template-marketplace/lib/asked-values/find-asked-value-issues";
import { findSecretValueIssues } from "@src/template-marketplace/lib/asked-values/find-secret-value-issues";
import { createTemplateInvalidError } from "@src/template-marketplace/lib/template-invalid/template-invalid-error";

export type VersionContentCarried = { readme?: string | null; askedValues?: AskedValue[] };

/** A legacy save sends neither a readme nor asked values, so a version holding them hands them on, held to the checks a save through the new routes passes. */
export function contentCarriedByLegacySave(sdl: string, current: VersionContentCarried): VersionContentCarried {
  const askedValues = current.askedValues ?? [];
  const readme = current.readme ?? null;

  if (askedValues.length === 0 && readme === null) return {};

  const issues = [...findAskedValueIssues(sdl, askedValues), ...findSecretValueIssues(sdl, askedValues)];

  if (issues.length > 0) throw createTemplateInvalidError(issues);

  return { readme, askedValues };
}
