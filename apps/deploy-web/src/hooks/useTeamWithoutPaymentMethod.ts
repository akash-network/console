import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import type { OrganizationOutput } from "@src/types/organization";

export const DEPENDENCIES = { useActiveOrganization };

/** A team whose payment method is still unknown, e.g. mid switch, counts as having one so the banner never flashes. */
export function useTeamWithoutPaymentMethod(dependencies: typeof DEPENDENCIES = DEPENDENCIES): OrganizationOutput | undefined {
  const { activeOrganization } = dependencies.useActiveOrganization();

  return activeOrganization?.type === "team" && activeOrganization.hasPaymentMethod === false ? activeOrganization : undefined;
}
