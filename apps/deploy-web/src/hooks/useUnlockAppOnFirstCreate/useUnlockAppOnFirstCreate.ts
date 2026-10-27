import { useEffect, useRef } from "react";

import { useIsOnboarded } from "@src/hooks/useIsOnboarded";
import { useUser } from "@src/hooks/useUser";

export const DEPENDENCIES = { useUser, useIsOnboarded };

/** The api counts a user onboarded once it accepts their first create, so the profile is read again to let them past the onboarding gate right away. */
export function useUnlockAppOnFirstCreate(dseq: string | null, dependencies: typeof DEPENDENCIES = DEPENDENCIES): void {
  const { checkSession } = dependencies.useUser();
  const isOnboarded = dependencies.useIsOnboarded();
  const refreshedForDseqRef = useRef<string | null>(null);

  useEffect(
    function refreshProfileOnceCreateIsAccepted() {
      if (!dseq || isOnboarded || refreshedForDseqRef.current === dseq) return;

      refreshedForDseqRef.current = dseq;
      checkSession().catch(() => undefined);
    },
    [dseq, isOnboarded, checkSession]
  );
}
