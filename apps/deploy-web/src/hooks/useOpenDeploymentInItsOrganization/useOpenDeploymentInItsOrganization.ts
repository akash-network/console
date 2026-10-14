import { useEffect, useRef } from "react";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useDeploymentLocationQuery } from "@src/queries/useDeploymentProjectQueries";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useFlag, useActiveOrganization, useDeploymentLocationQuery };

interface Input {
  dseq: string;
  /** The active organization could not read the deployment; another owner may hold the same dseq, so only then is it looked up elsewhere. */
  isMissingHere: boolean;
  /** The page's query string, kept across the switch. */
  query: string;
}

/** A link to a deployment of another of the user's organizations switches to that organization instead of reading as not found. */
export function useOpenDeploymentInItsOrganization({ dseq, isMissingHere, query }: Input, dependencies: typeof DEPENDENCIES = DEPENDENCIES): void {
  const d = dependencies;
  const isOrganizationsEnabled = d.useFlag("organizations");
  const { organizations, activeOrganization, switchOrganization } = d.useActiveOrganization();
  const { data: location } = d.useDeploymentLocationQuery(dseq, { enabled: isOrganizationsEnabled && !!activeOrganization && isMissingHere });
  const hasSwitched = useRef(false);

  const owningOrganizationId = location?.organizationId;
  const isElsewhere = isMissingHere && !!owningOrganizationId && !!activeOrganization && owningOrganizationId !== activeOrganization.id;
  const isMemberThere = organizations.some(organization => organization.id === owningOrganizationId);

  useEffect(
    function switchToTheDeploymentsOrganization() {
      if (!isElsewhere || !isMemberThere || !owningOrganizationId || hasSwitched.current) return;

      hasSwitched.current = true;
      switchOrganization(owningOrganizationId, { destination: `${UrlService.deploymentDetails(dseq)}${query ? `?${query}` : ""}` });
    },
    [isElsewhere, isMemberThere, owningOrganizationId, switchOrganization, dseq, query]
  );
}
