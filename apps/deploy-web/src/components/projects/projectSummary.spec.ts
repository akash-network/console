import { describe, expect, it } from "vitest";

import type { ProjectDeploymentPreview, ProjectDeploymentStatus } from "@src/types/project";
import { isProblemStatus, rankActiveDeployments, selectFolderSheets } from "./projectSummary";

describe(rankActiveDeployments.name, () => {
  it("puts problems first, worst first, and keeps the api order among equals", () => {
    const ranked = rankActiveDeployments([
      preview("web", "running"),
      preview("cache", "pending"),
      preview("db", "running"),
      preview("worker", "degraded"),
      preview("api", "pending")
    ]);

    expect(ranked.map(deployment => deployment.name)).toEqual(["worker", "cache", "api", "web", "db"]);
  });
});

describe(isProblemStatus.name, () => {
  it("flags a deployment that lost its leases or is still waiting for one", () => {
    expect((["degraded", "pending", "running"] as const).map(isProblemStatus)).toEqual([true, true, false]);
  });
});

describe(selectFolderSheets.name, () => {
  it("files no sheet for a project without active deployments", () => {
    expect(selectFolderSheets({ activeCount: 0, preview: [] })).toEqual({ sheets: [], bulkEdges: 0 });
  });

  it("files no sheet for a project whose deployments the caller may not see", () => {
    expect(selectFolderSheets(null)).toEqual({ sheets: [], bulkEdges: 0 });
  });

  it("files every deployment up to three", () => {
    const { sheets, bulkEdges } = selectFolderSheets({
      activeCount: 3,
      preview: [preview("web", "running"), preview("db", "running"), preview("cache", "pending")]
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

function preview(name: string, status: ProjectDeploymentStatus): ProjectDeploymentPreview {
  return { dseq: name, name, status };
}
