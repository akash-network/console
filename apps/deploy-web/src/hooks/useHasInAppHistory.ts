import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/router";

import routeStore from "@src/store/routeStore";

/**
 * Records that an in-app navigation happened. Must be mounted app-wide and exactly once: a component
 * that subscribes only when it renders would attach after the navigation it needs to observe.
 */
export const useTrackInAppNavigation = () => {
  const router = useRouter();
  const setHasNavigatedInApp = useSetAtom(routeStore.hasNavigatedInApp);

  useEffect(function subscribeToRouteChanges() {
    const markAsNavigated = () => {
      setHasNavigatedInApp(true);
    };

    router.events?.on("routeChangeStart", markAsNavigated);

    return () => {
      router.events?.off("routeChangeStart", markAsNavigated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

/**
 * Whether `router.back()` is safe to call. False when the current page is the session's entry point —
 * going back from there would leave the app entirely, so callers should push an in-app route instead.
 */
export const useHasInAppHistory = (): boolean => {
  return useAtomValue(routeStore.hasNavigatedInApp);
};
