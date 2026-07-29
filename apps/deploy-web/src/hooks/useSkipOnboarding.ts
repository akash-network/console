import { useCallback } from "react";
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
 * profile so the onboarding gate stops routing the user back in, then lands them on the deployments list. The profile
 * refresh is awaited before navigating to avoid a race where the gate bounces a still-flagless user back to onboarding;
 * a failed refresh reports the error and stays put — the gate would still see a flagless user and bounce the navigation
 * anyway, and since the flag is already persisted the user can retry or simply reload to get through.
 */
export function useSkipOnboarding(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { consoleApiHttpClient, analyticsService, urlService, errorHandler } = useServices();
  const { checkSession } = dependencies.useUser();
  const router = dependencies.useRouter();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: () => consoleApiHttpClient.post("/v1/user/skipOnboarding"),
    onError: error => errorHandler.reportError({ error, tags: { category: "onboarding" } })
  });

  const skip = useCallback(
    async (source: SkipOnboardingSource) => {
      analyticsService.track("onboarding_skipped", { category: "onboarding", source });

      try {
        await mutateAsync();
      } catch {
        return;
      }

      try {
        await checkSession();
      } catch (error) {
        errorHandler.reportError({ error, tags: { category: "onboarding" } });
        return;
      }

      router.push(urlService.deploymentList());
    },
    [analyticsService, mutateAsync, checkSession, router, urlService, errorHandler]
  );

  return { skip, isSkipping: isPending };
}
