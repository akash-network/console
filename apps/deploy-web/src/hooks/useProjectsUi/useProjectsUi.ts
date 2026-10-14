import { canChangeDeployments, canManageProjects } from "@src/components/organizations/organizationAccess";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";

export const DEPENDENCIES = { useFlag, useActiveOrganization };

export interface ProjectsUi {
  /** Whether deployments show and pick their project: the organizations flag is on and the active organization uses projects. */
  isEnabled: boolean;
  /** Whether the caller may create, rename and delete projects and move deployments between them, which only owners and admins can. */
  canManageProjects: boolean;
  /** Whether the caller may start, close or change deployments; viewers and billing members of an organization only read them. */
  canChangeDeployments: boolean;
  organizationName: string;
}

export function useProjectsUi(dependencies: typeof DEPENDENCIES = DEPENDENCIES): ProjectsUi {
  const isOrganizationsEnabled = dependencies.useFlag("organizations");
  const { activeOrganization, projectsEnabled } = dependencies.useActiveOrganization();
  const isEnabled = isOrganizationsEnabled && projectsEnabled;
  const role = isOrganizationsEnabled ? activeOrganization?.role : undefined;

  return {
    isEnabled,
    canManageProjects: isEnabled && !!role && canManageProjects(role),
    canChangeDeployments: !role || canChangeDeployments(role),
    organizationName: activeOrganization?.name ?? ""
  };
}
