import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import { addCachedOrganization } from "./useOrganizationQueries";

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
    onSuccess: ({ data: joined }) => addCachedOrganization(queryClient, joined),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: api.v1.previewInvitation.getKey() }),
        queryClient.invalidateQueries({ queryKey: api.v1.listReceivedInvitations.getKey() })
      ])
  });
}

const RECEIVED_INVITATIONS_POLL_MS = 60_000;

export function useReceivedInvitationsQuery({ enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.listReceivedInvitations.useQuery(undefined, {
    enabled,
    meta: SKIP_REPORTING_REFUSED_INPUT,
    refetchInterval: RECEIVED_INVITATIONS_POLL_MS,
    select: response => response.data
  });
}

export function useAcceptReceivedInvitationMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.acceptReceivedInvitation.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: ({ data: joined }) => addCachedOrganization(queryClient, joined),
    onSettled: () => queryClient.invalidateQueries({ queryKey: api.v1.listReceivedInvitations.getKey() })
  });
}

export function useDeclineReceivedInvitationMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.declineReceivedInvitation.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSettled: () => queryClient.invalidateQueries({ queryKey: api.v1.listReceivedInvitations.getKey() })
  });
}
