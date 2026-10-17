import type { ProjectScope } from "@src/organization/types/organization-context";

type ListedProjectIds = (scope: Extract<ProjectScope, { kind: "projects" }>) => readonly string[];

/** A row filed in no project is within reach only of a scope that reaches every project. */
export function isProjectInScope(projectId: string | null, scope: ProjectScope, listed: ListedProjectIds): boolean {
  return scope.kind === "all" || (projectId !== null && listed(scope).includes(projectId));
}

export function readableProjectIdsOf(scope: Extract<ProjectScope, { kind: "projects" }>): readonly string[] {
  return scope.projectIds;
}

export function writableProjectIdsOf(scope: Extract<ProjectScope, { kind: "projects" }>): readonly string[] {
  return scope.writableProjectIds;
}
