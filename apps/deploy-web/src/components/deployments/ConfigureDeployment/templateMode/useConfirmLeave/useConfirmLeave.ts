import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/router";

import { useWarnBeforeUnload } from "@src/hooks/useWarnBeforeUnload/useWarnBeforeUnload";

export const DEPENDENCIES = { useRouter, useWarnBeforeUnload };

/** Next only cancels a route change when a `routeChangeStart` listener throws. */
const ROUTE_CHANGE_ABORTED = "Route change aborted to keep unsaved template changes.";

/**
 * Asks before an in-app navigation or an unload leaves unsaved changes behind. A shallow rewrite of the URL stays on the
 * screen, so it is never asked about. Returns `allowLeaving`, which lets the navigation a save starts through before
 * the saved state has rendered.
 */
export function useConfirmLeave(isDirty: boolean, message: string, dependencies: typeof DEPENDENCIES = DEPENDENCIES): () => void {
  const router = dependencies.useRouter();
  const isLeavingAllowedRef = useRef(false);
  dependencies.useWarnBeforeUnload(isDirty);

  useEffect(
    function confirmInAppLeave() {
      if (!isDirty) return;

      function askBeforeLeaving(url: string, { shallow }: { shallow: boolean }) {
        if (shallow || isLeavingAllowedRef.current || window.confirm(message)) return;

        router.events.emit("routeChangeError", new Error(ROUTE_CHANGE_ABORTED), url, { shallow });
        throw ROUTE_CHANGE_ABORTED;
      }

      router.events.on("routeChangeStart", askBeforeLeaving);
      return function stopConfirmingLeave() {
        router.events.off("routeChangeStart", askBeforeLeaving);
      };
    },
    [isDirty, message, router]
  );

  return useCallback(() => {
    isLeavingAllowedRef.current = true;
  }, []);
}
