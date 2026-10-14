import type { Project, ProjectDeploymentPreview, ProjectDeploymentStatus, ProjectDeploymentSummary } from "@src/types/project";

/** Problems come out of the folder first, so a degraded sheet is the one furthest back and highest. */
const STATUS_RANK: Record<ProjectDeploymentStatus, number> = { degraded: 0, reclaiming: 1, spinning: 2, running: 3, closed: 3 };

const PROBLEM_STATUSES: ReadonlySet<ProjectDeploymentStatus> = new Set(["degraded", "reclaiming", "spinning"]);

/** Past this many sheets the last one turns into a "+N more" sheet, so a folder never grows taller. */
export const MAX_FOLDER_SHEETS = 3;

const MAX_BULK_EDGES = 3;

export type FolderSheet = { kind: "deployment"; deployment: ProjectDeploymentPreview } | { kind: "more"; count: number };

export function isProblemStatus(status: ProjectDeploymentStatus): boolean {
  return PROBLEM_STATUSES.has(status);
}

export function rankActiveDeployments(preview: ProjectDeploymentPreview[]): ProjectDeploymentPreview[] {
  return preview.filter(deployment => deployment.status !== "closed").sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
}

/** Which sheets a folder files and how many empty edges peek out behind them, from the summary the api sends. */
export function selectFolderSheets(summary: ProjectDeploymentSummary | undefined): { sheets: FolderSheet[]; bulkEdges: number } {
  const ranked = rankActiveDeployments(summary?.preview ?? []);
  const activeCount = Math.max(summary?.activeCount ?? 0, ranked.length);
  const deploymentSheets = ranked.map((deployment): FolderSheet => ({ kind: "deployment", deployment }));

  if (activeCount <= MAX_FOLDER_SHEETS) return { sheets: deploymentSheets, bulkEdges: 0 };

  return {
    sheets: [...deploymentSheets.slice(0, MAX_FOLDER_SHEETS - 1), { kind: "more", count: activeCount - (MAX_FOLDER_SHEETS - 1) }],
    bulkEdges: Math.min(MAX_BULK_EDGES, activeCount - MAX_FOLDER_SHEETS)
  };
}

/** The api keeps no time of a project's last deployment, so the newest projects lead. */
export function sortProjectsNewestFirst(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** To those who manage projects, the default project every organization carries only shows once it holds open deployments, so a fresh organization reads as empty. */
export function isProjectListed(project: Project): boolean {
  const summary = project.deploymentSummary;
  return !project.isDefault || (summary?.activeCount ?? summary?.preview.length ?? 0) > 0;
}
