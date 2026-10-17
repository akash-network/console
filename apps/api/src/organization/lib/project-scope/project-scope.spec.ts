import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { ProjectScope } from "@src/organization/types/organization-context";
import { isProjectInScope, readableProjectIdsOf, writableProjectIdsOf } from "./project-scope";

describe(isProjectInScope.name, () => {
  const readOnlyProjectId = faker.string.uuid();
  const writableProjectId = faker.string.uuid();
  const scope: ProjectScope = {
    kind: "projects",
    projectIds: [readOnlyProjectId, writableProjectId],
    writableProjectIds: [writableProjectId],
    adminProjectIds: []
  };

  it.each([
    ["a project", faker.string.uuid()],
    ["no project", null]
  ])("reaches %s within a scope of every project", (_, projectId) => {
    expect(isProjectInScope(projectId, { kind: "all" }, readableProjectIdsOf)).toBe(true);
  });

  it("reaches a listed project", () => {
    expect(isProjectInScope(readOnlyProjectId, scope, readableProjectIdsOf)).toBe(true);
    expect(isProjectInScope(writableProjectId, scope, writableProjectIdsOf)).toBe(true);
  });

  it("does not reach a project the list leaves out", () => {
    expect(isProjectInScope(readOnlyProjectId, scope, writableProjectIdsOf)).toBe(false);
    expect(isProjectInScope(faker.string.uuid(), scope, readableProjectIdsOf)).toBe(false);
  });

  it("does not reach a row in no project within a scope of some projects", () => {
    expect(isProjectInScope(null, scope, readableProjectIdsOf)).toBe(false);
  });
});
