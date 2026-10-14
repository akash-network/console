import { ApiError } from "@akashnetwork/openapi-sdk";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { DeploymentLocation } from "@src/types/project";
import { ORGANIZATION_ACTIVITIES_QUERY_KEY } from "./useOrganizationActivitiesQuery";
import { PROJECTS_QUERY_KEY } from "./useProjectsQuery";

/** Equal to `api.v1.<operation>.getKey()`, for readers that hold a query client but not the SDK. */
export const DEPLOYMENT_LOCATION_QUERY_KEY = ["v1", "getDeploymentLocation"] as const;
export const DEPLOYMENTS_LIST_QUERY_KEY = ["v1", "listDeployments"] as const;

const NOT_FOUND_STATUS = 404;

/** Where a deployment is filed: its organization and project, or null for one the caller cannot reach. */
export function useDeploymentLocationQuery(dseq: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { api } = useServices();

  return api.v1.getDeploymentLocation.useQuery(
    { dseq },
    { enabled, catchError: readUnreachableAsUnfiled, select: (response): DeploymentLocation | null => response?.data ?? null }
  );
}

/** Files a deployment under another project of the active organization. */
export function useUpdateDeploymentProjectMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.updateDeploymentProject.useMutation({
    onSuccess: () => invalidateDeploymentMoveQueries(queryClient)
  });
}

/** A move changes which lists hold the deployment, where it is filed, the project counts and the activity feed. */
export function invalidateDeploymentMoveQueries(queryClient: QueryClient) {
  return Promise.all(
    [DEPLOYMENTS_LIST_QUERY_KEY, DEPLOYMENT_LOCATION_QUERY_KEY, PROJECTS_QUERY_KEY, ORGANIZATION_ACTIVITIES_QUERY_KEY].map(queryKey =>
      queryClient.invalidateQueries({ queryKey })
    )
  );
}

function readUnreachableAsUnfiled(error: Error): null {
  if (error instanceof ApiError && error.status === NOT_FOUND_STATUS) return null;
  throw error;
}
