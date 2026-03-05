import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useServices } from "@src/context/ServicesProvider";

export const DEPENDENCIES = {
  useRouter,
  useSearchParams,
  useServices,
  window: typeof window === "undefined" ? undefined : window
};

export interface UseReturnToOptions<TDefaultReturnTo extends string | null | undefined = undefined> {
  dependencies?: typeof DEPENDENCIES;
  /** Default returnTo URL to use when none is provided in query params */
  defaultReturnTo?: TDefaultReturnTo;
}

export type ReturnToPageType = "deployment" | "onboarding" | "auth" | "other" | null;

export interface UseReturnToResult<TDefaultReturnTo extends string | null | undefined = undefined> {
  /** The current returnTo URL (validated and safe) */
  returnTo: TDefaultReturnTo extends string ? string : string | null;
  /**
   * Navigate to `path` while pushing the current location onto the returnTo stack.
   *
   * `extraQueryParams` are merged into the pushed returnTo entry (not into the target URL).
   */
  navigateWithReturnTo: (path: string, extraQueryParams?: Record<string, string>) => void;
  /** Navigate back to the returnTo URL */
  navigateBack: () => void;
  /** Check if there's a returnTo */
  hasReturnTo: boolean;
  /** Check if returnTo is a deployment page */
  isDeploymentReturnTo: boolean;
}

/**
 * Manage return-to navigation for auth/onboarding flows.
 *
 * This hook uses a multi-`returnTo` stack (multiple `returnTo` query params) with a legacy `from` fallback.
 * The stack behavior is implemented by `UrlReturnToStack` (exposed via DI as `urlReturnToStack`).
 *
 * Semantics:
 * - `returnTo`: computed by popping the top returnTo entry (validated) and carrying the remaining stack forward.
 * - `navigateBack()`: navigates to `returnTo`.
 * - `navigateWithReturnTo(path)`: pushes the current location (stripped of returnTo/from) onto the stack and navigates to `path`.
 *
 * SSR note: this is a client hook (depends on `window` and `useSearchParams`). When `window` is unavailable,
 * `returnTo` falls back to `defaultReturnTo` and `navigateWithReturnTo` falls back to navigating to `path` as-is.
 */
export const useReturnTo = <TDefaultReturnTo extends string | null | undefined = undefined>(
  { dependencies: d = DEPENDENCIES, defaultReturnTo }: UseReturnToOptions<TDefaultReturnTo> = {} as UseReturnToOptions<TDefaultReturnTo>
): UseReturnToResult<TDefaultReturnTo> => {
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const { urlReturnToStack } = d.useServices();

  const currentLocation = useMemo(() => {
    if (typeof d.window === "undefined") return "/";
    const qs = searchParams.toString();
    return `${d.window.location.pathname}${qs ? `?${qs}` : ""}`;
  }, [d.window, searchParams]);

  const returnTo = useMemo(() => {
    if (typeof d.window === "undefined") {
      return defaultReturnTo;
    }
    const computed = urlReturnToStack.getReturnTo(currentLocation);
    const hasDefault = defaultReturnTo !== undefined && defaultReturnTo !== null;

    if ((!computed || computed === "/") && hasDefault) {
      return defaultReturnTo;
    }

    return computed;
  }, [currentLocation, d.window, defaultReturnTo, urlReturnToStack]);

  /**
   * Navigate to `path` while stacking the current location as a returnTo entry.
   *
   * This uses the current URL (pathname + search params) as the entry to push.
   */
  const navigateWithReturnTo = useCallback(
    (path: string, extraQueryParams?: Record<string, string>) => {
      if (typeof d.window === "undefined") {
        router.push(path);
        return;
      }

      router.push(urlReturnToStack.createReturnable(currentLocation, path, { extraQueryParams }));
    },
    [currentLocation, d.window, router, urlReturnToStack]
  );

  /** Navigate back using the popped returnTo URL (already includes remaining stack). */
  const navigateBack = useCallback(() => {
    if (!returnTo) {
      throw new Error("No returnTo found");
    }

    router.push(returnTo);
  }, [returnTo, router]);

  /**
   * Detect page type from the computed `returnTo` navigation URL.
   *
   * Note: `returnTo` is a navigation-ready URL (destination + remaining stack carried forward), not a raw "peek".
   */
  const getReturnToPageType = useCallback((): ReturnToPageType => {
    if (!returnTo) return null;

    const path = returnTo.split("?")[0];
    const lowerPath = path.toLowerCase();

    if (lowerPath.startsWith("/new-deployment") || lowerPath.startsWith("/deploy-linux") || lowerPath.startsWith("/deployments/")) {
      return "deployment";
    }
    if (lowerPath.startsWith("/signup") || lowerPath.startsWith("/onboarding")) {
      return "onboarding";
    }
    if (lowerPath.startsWith("/login")) {
      return "auth";
    }

    return null;
  }, [returnTo]);

  const isDeploymentReturnTo = useMemo(() => getReturnToPageType() === "deployment", [getReturnToPageType]);

  return useMemo(
    () =>
      ({
        returnTo: returnTo as TDefaultReturnTo extends string ? string : string | null,
        navigateWithReturnTo,
        navigateBack,
        hasReturnTo: !!returnTo,
        isDeploymentReturnTo
      }) as UseReturnToResult<TDefaultReturnTo>,
    [returnTo, navigateWithReturnTo, navigateBack, isDeploymentReturnTo]
  );
};
