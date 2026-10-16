import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import { ORGANIZATION_ACTIVITIES_QUERY_KEY } from "./useOrganizationActivitiesQuery";
import { ORGANIZATIONS_QUERY_KEY } from "./useOrganizationQueries";
import { PROJECT_MEMBERS_QUERY_KEY } from "./useProjectMembersQuery";

export function useOrganizationMembersQuery({ enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.listOrganizationMembers.useQuery(undefined, { enabled, select: response => response.data });
}

export function useOrganizationMemberProjectGrantsQuery(memberId: string, { enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.listOrganizationMemberProjectGrants.useQuery({ id: memberId }, { enabled, select: response => response.data });
}

/** A member's role and access decide who each project lists and what the feed records, so those are refetched along with the roster. */
export function useUpdateOrganizationMemberMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.updateOrganizationMember.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () =>
      Promise.all(
        [
          api.v1.listOrganizationMembers.getKey(),
          api.v1.listOrganizationMemberProjectGrants.getKey(),
          PROJECT_MEMBERS_QUERY_KEY,
          ORGANIZATION_ACTIVITIES_QUERY_KEY
        ].map(queryKey => queryClient.invalidateQueries({ queryKey }))
      )
  });
}

export function useDeleteOrganizationMemberMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.deleteOrganizationMember.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.v1.listOrganizationMembers.getKey() })
  });
}

/** The caller steps down to admin, so their membership list is refetched along with the roster. */
export function useTransferOrganizationOwnershipMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.transferOrganizationOwnership.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: api.v1.listOrganizationMembers.getKey() }),
        queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY })
      ])
  });
}
