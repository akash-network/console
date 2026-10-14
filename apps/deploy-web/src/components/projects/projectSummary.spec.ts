import { describe, expect, it } from "vitest";

import type { Project, ProjectDeploymentPreview, ProjectDeploymentStatus } from "@src/types/project";
import { isProjectListed, rankActiveDeployments, selectFolderSheets, sortProjectsNewestFirst } from "./projectSummary";

describe(rankActiveDeployments.name, () => {
  it("puts problems first, worst first, and keeps the api order among equals", () => {
    const ranked = rankActiveDeployments([
      preview("web", "running"),
      preview("cache", "reclaiming"),
      preview("db", "running"),
      preview("worker", "degraded"),
      preview("api", "spinning")
    ]);

    expect(ranked.map(deployment => deployment.name)).toEqual(["worker", "cache", "api", "web", "db"]);
  });

  it("leaves closed deployments out", () => {
    expect(rankActiveDeployments([preview("old", "closed"), preview("web", "running")]).map(deployment => deployment.name)).toEqual(["web"]);
  });
});

describe(selectFolderSheets.name, () => {
  it("files no sheet for a project without active deployments", () => {
    expect(selectFolderSheets({ activeCount: 0, preview: [] })).toEqual({ sheets: [], bulkEdges: 0 });
  });

  it("files every deployment up to three", () => {
    const { sheets, bulkEdges } = selectFolderSheets({
      activeCount: 3,
      preview: [preview("web", "running"), preview("db", "running"), preview("cache", "reclaiming")]
    });

    expect(sheets.map(sheet => (sheet.kind === "deployment" ? sheet.deployment.name : sheet.kind))).toEqual(["cache", "web", "db"]);
    expect(bulkEdges).toBe(0);
  });

  it("replaces the third sheet with a count past three and shows bulk edges for the rest", () => {
    const { sheets, bulkEdges } = selectFolderSheets({
      activeCount: 5,
      preview: [preview("web", "running"), preview("db", "running"), preview("cache", "running")]
    });

    expect(sheets).toEqual([
      { kind: "deployment", deployment: preview("web", "running") },
      { kind: "deployment", deployment: preview("db", "running") },
      { kind: "more", count: 3 }
    ]);
    expect(bulkEdges).toBe(2);
  });

  it("caps the bulk edges at three however big the project is", () => {
    expect(selectFolderSheets({ activeCount: 12, preview: [preview("web", "running")] }).bulkEdges).toBe(3);
  });

  it("trusts the preview over a smaller count", () => {
    const { sheets } = selectFolderSheets({ activeCount: 1, preview: [preview("web", "running"), preview("db", "running")] });

    expect(sheets).toHaveLength(2);
  });
});

describe(sortProjectsNewestFirst.name, () => {
  it("orders projects by creation, newest first", () => {
    const sorted = sortProjectsNewestFirst([
      project({ name: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
      project({ name: "fresh", createdAt: "2026-08-01T00:00:00.000Z" }),
      project({ name: "middle", createdAt: "2026-02-01T00:00:00.000Z" })
    ]);

    expect(sorted.map(item => item.name)).toEqual(["fresh", "middle", "old"]);
  });
});

describe(isProjectListed.name, () => {
  it("lists every project that is not the default one", () => {
    expect(isProjectListed(project({ name: "storefront" }))).toBe(true);
  });

  it("hides the default project while it holds no open deployment", () => {
    expect(isProjectListed(project({ name: "default", isDefault: true }))).toBe(false);
  });

  it("hides the default project until its deployments are read", () => {
    expect(isProjectListed({ ...project({ name: "default", isDefault: true }), deploymentSummary: undefined })).toBe(false);
  });

  it("lists the default project once it holds an open deployment", () => {
    expect(isProjectListed(project({ name: "default", isDefault: true, activeCount: 1 }))).toBe(true);
  });

  it("lists the default project when its deployments could not be counted but some were read", () => {
    const defaultProject = project({ name: "default", isDefault: true });

    expect(isProjectListed({ ...defaultProject, deploymentSummary: { activeCount: undefined, preview: [preview("web", "running")] } })).toBe(true);
  });
});

function preview(name: string, status: ProjectDeploymentStatus): ProjectDeploymentPreview {
  return { dseq: name, name, status };
}

function project(input: { name: string; createdAt?: string; activeCount?: number; isDefault?: boolean }): Project {
  return {
    id: input.name,
    name: input.name,
    slug: input.name,
    description: null,
    isDefault: input.isDefault ?? false,
    createdAt: input.createdAt ?? "2026-01-01T00:00:00.000Z",
    createdBy: null,
    deploymentSummary: { activeCount: input.activeCount ?? 0, preview: [] }
  };
}
