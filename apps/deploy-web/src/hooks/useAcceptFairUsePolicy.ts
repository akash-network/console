import { useCallback, useState } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import { SKIP_REPORTING_HANDLED_BY_CALLER } from "@src/services/query-error-policy/query-error-policy";

export const DEPENDENCIES = {
  useUser
};

/**
 * Closes the gate on the server's confirmation rather than on the refreshed profile, which resolves stale both when
 * Auth0 swallows a failed profile fetch and when the profile route fails open without the timestamp.
 */
export function useAcceptFairUsePolicy(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api, analyticsService, errorHandler } = useServices();
  const { checkSession } = dependencies.useUser();
  const [hasAccepted, setHasAccepted] = useState(false);

  const { mutateAsync, isPending } = api.v1.acceptFairUsePolicy.useMutation({
    onSuccess: async () => {
      analyticsService.track("fair_use_policy_accepted", { category: "user" });
      setHasAccepted(true);
      await checkSession();
    },
    onError: error => errorHandler.reportError({ error, tags: { category: "user" } }),
    meta: SKIP_REPORTING_HANDLED_BY_CALLER
  });

  const accept = useCallback(async () => {
    await mutateAsync().catch(() => undefined);
  }, [mutateAsync]);

  return { accept, isAccepting: isPending, hasAccepted };
}
