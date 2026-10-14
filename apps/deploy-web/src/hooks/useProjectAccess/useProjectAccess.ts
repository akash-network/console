import { useMemo } from "react";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useProjectRolesOfUser } from "@src/queries/useProjectMembersQuery";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import type { OrganizationRole } from "@src/types/organization";
import type { ProjectRole } from "@src/types/project";

export const DEPENDENCIES = { useFlag, useActiveOrganization, useUser, useProjectsQuery, useProjectRolesOfUser };

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
  /** The caller's projects or grants could not be read, so the checks they decide answer no until `retry` reads them. */
  isError: boolean;
  retry: () => void;
}

const UNRESTRICTED_ROLES: ReadonlySet<OrganizationRole> = new Set(["owner", "admin"]);

const MANAGING_PROJECT_ROLES: ReadonlySet<ProjectRole> = new Set(["member", "admin"]);

const NO_PROJECT_IDS: string[] = [];

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

/** What the caller may do in each project: owners and admins everything, an organization member what each grant's role allows, anyone else only look. */
export function useProjectAccess(dependencies: typeof DEPENDENCIES = DEPENDENCIES): ProjectAccess {
  const d = dependencies;
  const isOrganizationsEnabled = d.useFlag("organizations");
  const { activeOrganization, isLoading: isLoadingOrganization, projectsEnabled } = d.useActiveOrganization();
  const { user } = d.useUser();
  const role = activeOrganization?.role;
  const isRestricted = isOrganizationsEnabled && projectsEnabled && !!role && !UNRESTRICTED_ROLES.has(role);
  const readsGrants = isRestricted && role === "member";
  const projectsQuery = d.useProjectsQuery({ enabled: isRestricted });
  const refetchProjects = projectsQuery.refetch;
  const projectIds = useMemo(() => projectsQuery.data?.map(project => project.id) ?? NO_PROJECT_IDS, [projectsQuery.data]);
  const grants = d.useProjectRolesOfUser(projectIds, user?.id, { enabled: readsGrants });

  return useMemo(() => {
    if (!isOrganizationsEnabled) return UNRESTRICTED;
    if (isLoadingOrganization) return AWAITING_ACCESS;
    if (!isRestricted) return UNRESTRICTED;
    if (projectsQuery.isLoading || (readsGrants && grants.isLoading)) return AWAITING_ACCESS;
    if (!projectsQuery.data && projectsQuery.isError) return { ...AWAITING_ACCESS, isLoading: false, isError: true, retry: () => void refetchProjects() };

    const projectRoleOf = (projectId: string | null | undefined) => (readsGrants && projectId ? grants.rolesByProjectId.get(projectId) : undefined);
    const canManageDeployments = (projectId: string | null | undefined) => {
      const projectRole = projectRoleOf(projectId);
      return !!projectRole && MANAGING_PROJECT_ROLES.has(projectRole);
    };

    return {
      isLoading: false,
      canManageDeployments,
      canManageAccess: projectId => projectRoleOf(projectId) === "admin",
      canDeployAnywhere: projectIds.some(canManageDeployments),
      hasNoProjects: projectsQuery.data?.length === 0,
      isError: readsGrants && grants.isError,
      retry: grants.retry
    };
  }, [
    isOrganizationsEnabled,
    isLoadingOrganization,
    isRestricted,
    readsGrants,
    projectsQuery.isLoading,
    projectsQuery.data,
    projectsQuery.isError,
    refetchProjects,
    projectIds,
    grants
  ]);
}
