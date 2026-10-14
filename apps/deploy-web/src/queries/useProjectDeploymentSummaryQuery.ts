import type { operationDefs } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";
import type { ProjectDeploymentSummary } from "@src/types/project";
import { toProjectDeploymentStatus } from "@src/utils/projectDeploymentStatus";

/** A folder files at most this many sheets, so no more of a project's deployments are read for it. */
export const PROJECT_PREVIEW_SIZE = 3;

/** Folders are many and their counts move slowly, so refocusing the window does not read them all again. */
export const PROJECT_SUMMARY_STALE_MS = 60_000;

type ListDeploymentsResponse = operationDefs["listDeployments"]["responses"][200]["content"]["application/json"];

/** A project's open deployments as its folder shows them: the newest few, and how many there are in all. */
export function useProjectDeploymentSummaryQuery(projectId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { api } = useServices();

  return api.v1.listDeployments.useQuery(
    { projectId, state: "active", reverse: "true", limit: PROJECT_PREVIEW_SIZE },
    { enabled, staleTime: PROJECT_SUMMARY_STALE_MS, select: toDeploymentSummary }
  );
}

function toDeploymentSummary(response: ListDeploymentsResponse): ProjectDeploymentSummary {
  const { deployments, pagination } = response.data;

  return {
    activeCount: pagination.total ?? (pagination.hasMore ? undefined : deployments.length),
    preview: deployments.map(item => ({
      dseq: item.deployment.id.dseq,
      name: item.name || `Deployment #${item.deployment.id.dseq}`,
      status: toProjectDeploymentStatus(item)
    }))
  };
}
