import type { Project, ProjectDeploymentPreview, ProjectDeploymentStatus, ProjectDeploymentSummary } from "@src/types/project";

/** Problems come out of the folder first, so a degraded sheet is the one furthest back and highest. */
const STATUS_RANK: Record<ProjectDeploymentStatus, number> = { degraded: 0, pending: 1, running: 2 };

const PROBLEM_STATUSES: ReadonlySet<ProjectDeploymentStatus> = new Set(["degraded", "pending"]);

/** Past this many sheets the last one turns into a "+N more" sheet, so a folder never grows taller. */
export const MAX_FOLDER_SHEETS = 3;

const MAX_BULK_EDGES = 3;

export type FolderSheet = { kind: "deployment"; deployment: ProjectDeploymentPreview } | { kind: "more"; count: number };

export function isProblemStatus(status: ProjectDeploymentStatus): boolean {
  return PROBLEM_STATUSES.has(status);
}

export function rankActiveDeployments(preview: ProjectDeploymentPreview[]): ProjectDeploymentPreview[] {
  return [...preview].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
}

/** Which sheets a folder files and how many empty edges peek out behind them, from the summary the api sends. */
export function selectFolderSheets(summary: ProjectDeploymentSummary | null): { sheets: FolderSheet[]; bulkEdges: number } {
  const ranked = rankActiveDeployments(summary?.preview ?? []);
  const activeCount = Math.max(summary?.activeCount ?? 0, ranked.length);
  const deploymentSheets = ranked.map((deployment): FolderSheet => ({ kind: "deployment", deployment }));

  if (activeCount <= MAX_FOLDER_SHEETS) return { sheets: deploymentSheets, bulkEdges: 0 };

  return {
    sheets: [...deploymentSheets.slice(0, MAX_FOLDER_SHEETS - 1), { kind: "more", count: activeCount - (MAX_FOLDER_SHEETS - 1) }],
    bulkEdges: Math.min(MAX_BULK_EDGES, activeCount - MAX_FOLDER_SHEETS)
  };
}

/** To those who manage projects, the default project every organization carries only shows once it holds open deployments, so a fresh organization reads as empty. */
export function isProjectListed(project: Project): boolean {
  return !project.isDefault || !project.deployments || project.deployments.activeCount > 0;
}
