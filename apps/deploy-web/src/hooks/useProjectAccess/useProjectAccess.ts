import { useMemo } from "react";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import type { OrganizationRole } from "@src/types/organization";

export const DEPENDENCIES = { useFlag, useActiveOrganization, useProjectsQuery };

export interface ProjectAccess {
  /** The caller's rights are still being read, and every check answers no until they are. */
  isLoading: boolean;
  /** Whether the caller may deploy into the project and close, fund, change or move its deployments. */
  canManageDeployments: (projectId: string | null | undefined) => boolean;
  /** Whether the caller may grant, change and revoke other people's access to the project. */
  canManageAccess: (projectId: string) => boolean;
  /** Whether at least one project takes new deployments from the caller. */
  canDeployAnywhere: boolean;
  /** The caller reaches projects only through grants and holds none. */
  hasNoProjects: boolean;
  /** The caller's projects could not be read, so the checks they decide answer no until `retry` reads them. */
  isError: boolean;
  retry: () => void;
}

const UNRESTRICTED_ROLES: ReadonlySet<OrganizationRole> = new Set(["owner", "admin"]);

const NOTHING_TO_RETRY = () => undefined;

const UNRESTRICTED: ProjectAccess = {
  isLoading: false,
  canManageDeployments: () => true,
  canManageAccess: () => true,
  canDeployAnywhere: true,
  hasNoProjects: false,
  isError: false,
  retry: NOTHING_TO_RETRY
};

const AWAITING_ACCESS: ProjectAccess = {
  isLoading: true,
  canManageDeployments: () => false,
  canManageAccess: () => false,
  canDeployAnywhere: false,
  hasNoProjects: false,
  isError: false,
  retry: NOTHING_TO_RETRY
};

/** What the caller may do in each project: owners and admins everything, anyone else what the project list says of each project it reaches. */
export function useProjectAccess(dependencies: typeof DEPENDENCIES = DEPENDENCIES): ProjectAccess {
  const d = dependencies;
  const isOrganizationsEnabled = d.useFlag("organizations");
  const { activeOrganization, isLoading: isLoadingOrganization, projectsEnabled } = d.useActiveOrganization();
  const role = activeOrganization?.role;
  const isRestricted = isOrganizationsEnabled && projectsEnabled && !!role && !UNRESTRICTED_ROLES.has(role);
  const projectsQuery = d.useProjectsQuery({ enabled: isRestricted });
  const refetchProjects = projectsQuery.refetch;

  return useMemo(() => {
    if (!isOrganizationsEnabled) return UNRESTRICTED;
    if (isLoadingOrganization) return AWAITING_ACCESS;
    if (!isRestricted) return UNRESTRICTED;
    if (projectsQuery.isLoading) return AWAITING_ACCESS;
    if (!projectsQuery.data && projectsQuery.isError) return { ...AWAITING_ACCESS, isLoading: false, isError: true, retry: () => void refetchProjects() };

    const accessByProjectId = new Map((projectsQuery.data ?? []).map(project => [project.id, project.access]));

    return {
      isLoading: false,
      canManageDeployments: projectId => !!projectId && !!accessByProjectId.get(projectId)?.canDeploy,
      canManageAccess: projectId => !!accessByProjectId.get(projectId)?.canManage,
      canDeployAnywhere: [...accessByProjectId.values()].some(access => access.canDeploy),
      hasNoProjects: projectsQuery.data?.length === 0,
      isError: false,
      retry: NOTHING_TO_RETRY
    };
  }, [isOrganizationsEnabled, isLoadingOrganization, isRestricted, projectsQuery.isLoading, projectsQuery.data, projectsQuery.isError, refetchProjects]);
}
