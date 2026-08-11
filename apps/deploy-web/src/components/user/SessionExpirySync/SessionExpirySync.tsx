"use client";
import { useEffect, useRef } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";

export const DEPENDENCIES = { useUser };

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Converges client auth state with the server. A proxied API call that 401s means the server-side
 * session is dead while the Auth0 client context may still hold a cached user; re-fetching the
 * profile drops that user so `RequireAuth` routes to /login cleanly, instead of the app silently
 * firing more requests with an expired token (DEPLOY-WEB-2C4). The in-flight guard collapses a
 * burst of parallel 401s into a single re-check.
 */
export function SessionExpirySync({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { checkSession } = d.useUser();
  const { sessionExpiryNotifier, logger } = useServices();
  const isReCheckingRef = useRef(false);

  useEffect(
    function reCheckSessionOnExpiryNotice() {
      return sessionExpiryNotifier.subscribe(async () => {
        if (isReCheckingRef.current) return;
        isReCheckingRef.current = true;
        try {
          await checkSession();
        } catch (error) {
          logger.error({ event: "SESSION_RECHECK_FAILED", error });
        } finally {
          isReCheckingRef.current = false;
        }
      });
    },
    [sessionExpiryNotifier, checkSession, logger]
  );

  return null;
}
