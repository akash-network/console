import { useProjectAccess } from "@src/hooks/useProjectAccess/useProjectAccess";
import { useProjectsUi } from "@src/hooks/useProjectsUi/useProjectsUi";
import { useDeploymentLocationQuery } from "@src/queries/useDeploymentProjectQueries";

export const DEPENDENCIES = { useProjectsUi, useProjectAccess, useDeploymentLocationQuery };

export interface DeploymentManagement {
  /** Whether the caller may update, fund or close the deployment: their organization role allows it and so does the project it is filed under. */
  canManage: boolean;
  /** The answer may still turn to yes once the caller's access and the deployment's project are read. */
  isLoading: boolean;
  /** The caller's access or the deployment's project could not be read, so the answer stays no until `retry` reads them. */
  isError: boolean;
  retry: () => void;
}

export function useCanManageDeployment(dseq: string, dependencies: typeof DEPENDENCIES = DEPENDENCIES): DeploymentManagement {
  const { isEnabled, canChangeDeployments } = dependencies.useProjectsUi();
  const access = dependencies.useProjectAccess();
  const locationQuery = dependencies.useDeploymentLocationQuery(dseq, { enabled: isEnabled });
  const canManage = canChangeDeployments && access.canManageDeployments(locationQuery.data?.projectId);
  const isUndecided = canChangeDeployments && !canManage;
  const isLocationUnreadable = isEnabled && !locationQuery.data && locationQuery.isError;

  const retry = () => {
    if (access.isError) access.retry();
    if (isLocationUnreadable) void locationQuery.refetch();
  };

  return {
    canManage,
    isLoading: isUndecided && (access.isLoading || (isEnabled && locationQuery.isLoading)),
    isError: isUndecided && (access.isError || isLocationUnreadable),
    retry
  };
}
