import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import type { ListOrganizationsResponse, OrganizationOutput } from "@src/types/organization";

/** Equals `api.v1.listOrganizations.getKey()`, for readers that hold a query client but not the SDK. */
export const ORGANIZATIONS_QUERY_KEY = ["v1", "listOrganizations"] as const;

export function useOrganizationsQuery({ enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.listOrganizations.useQuery(undefined, { enabled, select: response => response.data });
}

export function useCreateOrganizationMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.createOrganization.useMutation({
    onSuccess: response => addCachedOrganization(queryClient, response.data)
  });
}

export function useDeleteOrganizationMutation() {
  const { api } = useServices();

  return api.v1.deleteOrganization.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });
}

/** Invites into the active organization, which the proxy takes from the organization cookie only. */
export function useCreateOrganizationInvitationsMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.createOrganizationInvitations.useMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.v1.listOrganizationInvitations.getKey() })
  });
}

export function readCachedOrganizations(queryClient: QueryClient): OrganizationOutput[] | undefined {
  return queryClient.getQueryData<ListOrganizationsResponse>(ORGANIZATIONS_QUERY_KEY)?.data;
}

export function addCachedOrganization(queryClient: QueryClient, created: OrganizationOutput): void {
  queryClient.setQueryData<ListOrganizationsResponse>(ORGANIZATIONS_QUERY_KEY, response => ({ data: [...(response?.data ?? []), created] }));
}

export function useRenameOrganizationMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.updateOrganization.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: response => replaceCachedOrganization(queryClient, response.data)
  });
}

export function replaceCachedOrganization(queryClient: QueryClient, updated: OrganizationOutput): void {
  queryClient.setQueryData<ListOrganizationsResponse>(
    ORGANIZATIONS_QUERY_KEY,
    response => response && { data: response.data.map(organization => (organization.id === updated.id ? updated : organization)) }
  );
}

/** Leaves the cached memberships alone, since the switch out of the left team clears them and reloads them without it. */
export function useLeaveOrganizationMutation() {
  const { api } = useServices();

  return api.v1.deleteOrganizationMembership.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });
}
