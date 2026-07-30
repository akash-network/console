import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";

export type SkipOnboardingSource = "picker" | "auto_deploy";

export const DEPENDENCIES = {
  useUser,
  useRouter
};

/**
 * Permanently skips the onboarding flow: records the intent in analytics, persists the server-side flag, refreshes the
 * profile, then lands the user on the new-deployment page. Navigation waits until the refreshed profile actually carries
 * the skip flag — the onboarding gate reads that same profile, so navigating any earlier would bounce right back into
 * the funnel. This also covers the profile route failing open with a flagless 200 (it swallows its internal user
 * lookup's errors), which a resolved `checkSession()` alone cannot reveal. Any failure reports the error and stays
 * put: the flag is already persisted server-side, so retrying the (idempotent) skip or reloading gets the user
 * through. The whole persist-and-refresh sequence runs inside the mutation so `isSkipping` disables the trigger for
 * its full duration.
 */
export function useSkipOnboarding(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { consoleApiHttpClient, analyticsService, urlService, errorHandler } = useServices();
  const { user, checkSession } = dependencies.useUser();
  const router = dependencies.useRouter();
  const [isAwaitingSkippedProfile, setIsAwaitingSkippedProfile] = useState(false);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (source: SkipOnboardingSource) => {
      analyticsService.track("onboarding_skipped", { category: "onboarding", source });
      await consoleApiHttpClient.post("/v1/user/skipOnboarding");
      await checkSession();
    },
    onSuccess: () => setIsAwaitingSkippedProfile(true),
    onError: error => errorHandler.reportError({ error, tags: { category: "onboarding" } })
  });

  useEffect(
    function navigateOnceProfileCarriesSkipFlag() {
      if (isAwaitingSkippedProfile && user?.onboardingSkippedAt) router.push(urlService.newDeployment());
    },
    [isAwaitingSkippedProfile, user?.onboardingSkippedAt, router, urlService]
  );

  const skip = useCallback(
    async (source: SkipOnboardingSource) => {
      await mutateAsync(source).catch(() => undefined);
    },
    [mutateAsync]
  );

  return { skip, isSkipping: isPending };
}
