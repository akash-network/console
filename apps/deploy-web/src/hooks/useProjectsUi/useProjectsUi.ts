import { canChangeDeployments, canManageProjects } from "@src/components/organizations/organizationAccess";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";

export const DEPENDENCIES = { useActiveOrganization };

export interface ProjectsUi {
  /** Whether deployments show and pick their project: the active organization uses projects. */
  isEnabled: boolean;
  /** Whether the caller may create, rename and delete projects and move deployments between them, which only owners and admins can. */
  canManageProjects: boolean;
  /** Whether the caller may start, close or change deployments; viewers and billing members of an organization only read them. */
  canChangeDeployments: boolean;
  organizationName: string;
}

export function useProjectsUi(dependencies: typeof DEPENDENCIES = DEPENDENCIES): ProjectsUi {
  const { activeOrganization, projectsEnabled } = dependencies.useActiveOrganization();
  const role = activeOrganization?.role;

  return {
    isEnabled: projectsEnabled,
    canManageProjects: projectsEnabled && !!role && canManageProjects(role),
    canChangeDeployments: !role || canChangeDeployments(role),
    organizationName: activeOrganization?.name ?? ""
  };
}
