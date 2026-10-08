import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { usePacedValue } from "@src/hooks/usePacedValue/usePacedValue";
import { QueryKeys } from "@src/queries/queryKeys";

const TYPING_PACE = { wait: 500, maxWait: 2000 };

/** Checks whether `username` is free once typing pauses; pass `undefined` to skip the check. */
export function useUsernameAvailability(username: string | undefined) {
  const { consoleApiHttpClient } = useServices();
  const pacedUsername = usePacedValue(username, TYPING_PACE);
  const { data: isAvailable, isFetching } = useQuery({
    queryKey: QueryKeys.getUsernameAvailabilityKey(pacedUsername ?? ""),
    queryFn: async () => {
      const response = await consoleApiHttpClient.get<{ isAvailable: boolean }>(`/v1/user/checkUsernameAvailability/${encodeURIComponent(pacedUsername!)}`);
      return response.data.isAvailable;
    },
    enabled: !!pacedUsername
  });

  if (!username) return { isChecking: false, isAvailable: undefined };

  const isSettling = username !== pacedUsername;
  return {
    isChecking: isSettling || isFetching,
    isAvailable: isSettling ? undefined : isAvailable
  };
}
