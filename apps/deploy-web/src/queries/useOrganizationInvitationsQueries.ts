import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";

/** Only owners and admins may list invitations, so callers pass `enabled: false` for everyone else. */
export function useOrganizationInvitationsQuery({ enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.listOrganizationInvitations.useQuery(undefined, { enabled, select: response => response.data });
}

export function useResendOrganizationInvitationMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.resendOrganizationInvitation.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.v1.listOrganizationInvitations.getKey() })
  });
}

/** An expired invitation gets a fresh expiry along with its new link, so the pending list is refetched too. */
export function useCreateOrganizationInvitationLinkMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.createOrganizationInvitationLink.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.v1.listOrganizationInvitations.getKey() })
  });
}

export function useDeleteOrganizationInvitationMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.deleteOrganizationInvitation.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.v1.listOrganizationInvitations.getKey() })
  });
}
