import { useCallback, useMemo, useRef } from "react";
import type { NavigationGuard } from "next-navigation-guard";

import { useNavigationGuard } from "@src/hooks/useNavigationGuard/useNavigationGuard";

export const DEPENDENCIES = { useNavigationGuard };

type NavigationGuardParams = Parameters<NavigationGuard>[0];

export type LeaveControl = {
  /** Lets the navigation a save starts through before the saved state has rendered. */
  allowLeaving: () => void;
  /** Asks again, for when that navigation did not happen. */
  askBeforeLeaving: () => void;
};

/** Asks before an in-app navigation, a back or an unload leaves unsaved changes behind; a rewrite of this page's own URL, such as a draft id written back, is never asked about. */
export function useConfirmLeave(isDirty: boolean, message: string, dependencies: typeof DEPENDENCIES = DEPENDENCIES): LeaveControl {
  const isLeavingAllowedRef = useRef(false);
  const skipWhen = useCallback((params: NavigationGuardParams) => isLeavingAllowedRef.current || staysOnThisPage(params), []);
  dependencies.useNavigationGuard({ enabled: isDirty, message, skipWhen });

  return useMemo(
    () => ({
      allowLeaving: () => {
        isLeavingAllowedRef.current = true;
      },
      askBeforeLeaving: () => {
        isLeavingAllowedRef.current = false;
      }
    }),
    []
  );
}

function staysOnThisPage({ to, type }: NavigationGuardParams): boolean {
  return type === "replace" && new URL(to, window.location.href).pathname === window.location.pathname;
}
