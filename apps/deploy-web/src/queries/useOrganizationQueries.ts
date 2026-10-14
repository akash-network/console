import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
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
