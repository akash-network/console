import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";

export const DEPENDENCIES = {
  useUser
};

/**
 * Persists the acceptance, then refreshes the profile: the gate reads the same profile, so the modal closes only once
 * the refreshed session carries the timestamp. A failure is reported and leaves the modal up for a retry.
 */
export function useAcceptFairUsePolicy(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { consoleApiHttpClient, analyticsService, errorHandler } = useServices();
  const { checkSession } = dependencies.useUser();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      await consoleApiHttpClient.post("/v1/user/acceptFairUsePolicy");
      analyticsService.track("fair_use_policy_accepted", { category: "user" });
      await checkSession();
    },
    onError: error => errorHandler.reportError({ error, tags: { category: "user" } })
  });

  const accept = useCallback(async () => {
    await mutateAsync().catch(() => undefined);
  }, [mutateAsync]);

  return { accept, isAccepting: isPending };
}
