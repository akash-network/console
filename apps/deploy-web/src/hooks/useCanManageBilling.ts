import { canManageBilling } from "@src/components/organizations/organizationAccess";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";

export const DEPENDENCIES = { useActiveOrganization };

export function useCanManageBilling(dependencies: typeof DEPENDENCIES = DEPENDENCIES): boolean {
  const { activeOrganization, isLoading, isError } = dependencies.useActiveOrganization();

  if (activeOrganization) return canManageBilling(activeOrganization.role);

  return !isLoading && !isError;
}
