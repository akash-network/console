"use client";
import { useEffect, useRef, useState } from "react";

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
  const { checkSession, error } = d.useUser();
  const { sessionExpiryNotifier, logger } = useServices();
  const isReCheckingRef = useRef(false);
  const [reCheckSettleCount, setReCheckSettleCount] = useState(0);
  const reportedSettleCountRef = useRef(0);

  useEffect(
    function reCheckSessionOnExpiryNotice() {
      return sessionExpiryNotifier.subscribe(async () => {
        if (isReCheckingRef.current) return;
        isReCheckingRef.current = true;
        try {
          await checkSession();
        } catch (thrown) {
          logger.error({ event: "SESSION_RECHECK_FAILED", error: thrown });
        } finally {
          isReCheckingRef.current = false;
          setReCheckSettleCount(count => count + 1);
        }
      });
    },
    [sessionExpiryNotifier, checkSession, logger]
  );

  /**
   * Auth0's `checkSession` swallows a failed profile fetch (network error or 5xx) into the shared
   * `error` state and resolves rather than rejecting, so the catch above never fires for that case.
   * `reCheckSettleCount` ticks once per re-check this component triggered; only acting when it moves
   * past the last reported tick reports that re-check's error alone, so an unrelated auth error (the
   * app-boot profile fetch, the /login re-check) that also lands in `error` isn't mislabeled here.
   */
  useEffect(
    function reportReCheckOutcome() {
      if (reCheckSettleCount === reportedSettleCountRef.current) return;
      reportedSettleCountRef.current = reCheckSettleCount;
      if (error) logger.error({ event: "SESSION_RECHECK_FAILED", error });
    },
    [reCheckSettleCount, error, logger]
  );

  return null;
}
