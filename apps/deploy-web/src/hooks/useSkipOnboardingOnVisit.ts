import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useIsKnownNotOnboarded } from "@src/hooks/useIsKnownNotOnboarded";
import type { SkipOnboardingSource } from "@src/hooks/useSkipOnboarding";
import { useUser } from "@src/hooks/useUser";
import { SKIP_REPORTING_HANDLED_BY_CALLER } from "@src/services/query-error-policy/query-error-policy";

export const DEPENDENCIES = { useUser, useIsKnownNotOnboarded };

/** Skips onboarding in place on a page the user chose over the funnel, tried once per mount so a failed skip never loops. */
export function useSkipOnboardingOnVisit(source: SkipOnboardingSource, d: typeof DEPENDENCIES = DEPENDENCIES): void {
  const { consoleApiHttpClient, analyticsService, errorHandler } = useServices();
  const { checkSession } = d.useUser();
  const isKnownNotOnboarded = d.useIsKnownNotOnboarded();

  const { mutate, isIdle } = useMutation({
    mutationFn: async () => {
      analyticsService.track("onboarding_skipped", { category: "onboarding", source });
      await consoleApiHttpClient.post("/v1/user/skipOnboarding");
      await checkSession();
    },
    onError: error => errorHandler.reportError({ error, tags: { category: "onboarding" } }),
    meta: SKIP_REPORTING_HANDLED_BY_CALLER
  });

  useEffect(
    function skipOnceKnownNotOnboarded() {
      if (isKnownNotOnboarded && isIdle) mutate();
    },
    [isKnownNotOnboarded, isIdle, mutate]
  );
}
