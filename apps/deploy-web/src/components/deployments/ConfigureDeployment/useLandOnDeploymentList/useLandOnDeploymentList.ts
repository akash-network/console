import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useIsOnboarded } from "@src/hooks/useIsOnboarded";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useRouter, useUser, useIsOnboarded };

/** The api marks the user onboarded when it accepts their create, so a user the gate still sees as new has their profile read again first, or the gate sends them back to onboarding. */
export function useLandOnDeploymentList(acceptedDseq: string | null, dependencies: typeof DEPENDENCIES = DEPENDENCIES): void {
  const router = dependencies.useRouter();
  const { checkSession } = dependencies.useUser();
  const isOnboarded = dependencies.useIsOnboarded();
  const landedDseqRef = useRef<string | null>(null);

  useEffect(
    function landOnceTheApiTookTheDeployOn() {
      if (!acceptedDseq || landedDseqRef.current === acceptedDseq) return;
      landedDseqRef.current = acceptedDseq;

      async function land() {
        if (!isOnboarded) await checkSession().catch(() => undefined);
        router.replace(UrlService.deploymentList());
      }

      void land();
    },
    [acceptedDseq, isOnboarded, checkSession, router]
  );
}
