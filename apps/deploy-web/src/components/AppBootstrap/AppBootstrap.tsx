"use client";
import { useEffect } from "react";

import { useTrackInAppNavigation } from "@src/hooks/useHasInAppHistory";
import { migrateLocalStorage } from "@src/utils/localStorage";

export const DEPENDENCIES = {
  useTrackInAppNavigation,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  migrateLocalStorage
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Mount-once app side effects that belong to no single feature: local storage migrations and the
 * route history the "go back" affordances read. Rendered as a sibling rather than a provider because
 * nothing consumes a value from it, and it must sit inside the jotai store provider.
 */
export const AppBootstrap: React.FunctionComponent<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  d.useTrackInAppNavigation();

  useEffect(function applyLocalStorageMigrations() {
    d.migrateLocalStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
