import { isApiError } from "@akashnetwork/openapi-sdk";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";

export function useGpuWaitlistQuery(options?: { enabled?: boolean }) {
  const { api } = useServices();

  return api.v1.listGpuWaitlist.useQuery(undefined, { select: response => response.data, enabled: options?.enabled });
}

function isWaitlistLimitError(error: unknown): boolean {
  return isApiError(error) && (error.status === 409 || error.status === 429);
}

function isNotFoundError(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/** Hitting a waitlist limit is the user's state rather than a fault, so it is shown to them instead of being reported. */
const SKIP_REPORTING_WAITLIST_LIMIT = { skipErrorReporting: isWaitlistLimitError };

/** An email link can outlive its entry, so a 404 means the entry already ended rather than a fault. */
const SKIP_REPORTING_ENDED_ENTRY = { skipErrorReporting: isNotFoundError };

function useRefreshWaitlist() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: api.v1.listGpuWaitlist.getKey() });
}

export function useJoinGpuWaitlistMutation() {
  const { api } = useServices();

  return api.v1.joinGpuWaitlist.useMutation({ onSuccess: useRefreshWaitlist(), meta: SKIP_REPORTING_WAITLIST_LIMIT });
}

/** Refreshes the list even when leaving is refused, since a refusal means the entry moved on since the list was loaded. */
export function useLeaveGpuWaitlistMutation() {
  const { api } = useServices();

  return api.v1.leaveGpuWaitlist.useMutation({ onSettled: useRefreshWaitlist(), meta: SKIP_REPORTING_ENDED_ENTRY });
}

export function useKeepGpuWaitlistEntryMutation() {
  const { api } = useServices();

  return api.v1.keepGpuWaitlistEntry.useMutation({ onSettled: useRefreshWaitlist(), meta: SKIP_REPORTING_ENDED_ENTRY });
}
