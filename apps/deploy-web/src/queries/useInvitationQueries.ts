import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import { addCachedOrganization, readCachedOrganizations } from "./useOrganizationQueries";

export function useInvitationPreviewQuery(token: string | null | undefined) {
  const { api } = useServices();

  return api.v1.previewInvitation.useQuery(
    { data: { token: token ?? "" } },
    { enabled: !!token, meta: SKIP_REPORTING_REFUSED_INPUT, select: response => response.data }
  );
}

/** The joined organization is added to the cached memberships so the caller can switch into it right away. */
export function useAcceptInvitationMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.acceptInvitation.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: ({ data: joined }) => {
      const isKnown = readCachedOrganizations(queryClient)?.some(organization => organization.id === joined.id);
      if (!isKnown) addCachedOrganization(queryClient, joined);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: api.v1.previewInvitation.getKey() })
  });
}
