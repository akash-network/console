"use client";
import { useEffect } from "react";

import { useTrackInAppNavigation } from "@src/hooks/useHasInAppHistory";
import { rememberBrowserTimezone } from "@src/lib/browser-timezone/browser-timezone-cookie";
import { migrateLocalStorage } from "@src/utils/localStorage";
import { forgetRetiredStorage } from "@src/utils/retiredStorage/retiredStorage";

export const DEPENDENCIES = {
  useTrackInAppNavigation,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  migrateLocalStorage,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  forgetRetiredStorage,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  rememberBrowserTimezone
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Mount-once app side effects that belong to no single feature: local storage migrations, the browser timezone
 * sign-in reads, and the route history the "go back" affordances read. Rendered as a sibling
 * rather than a provider because nothing consumes a value from it, and it must sit inside the jotai store provider.
 */
export const AppBootstrap: React.FunctionComponent<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  d.useTrackInAppNavigation();

  useEffect(function applyLocalStorageMigrations() {
    d.migrateLocalStorage();
    d.forgetRetiredStorage(window.localStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(function shareBrowserTimezoneWithSignIn() {
    d.rememberBrowserTimezone(document, window.location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
