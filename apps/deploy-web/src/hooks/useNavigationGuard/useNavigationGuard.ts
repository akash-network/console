import { useMemo, useState } from "react";
import { usePopup } from "@akashnetwork/ui/context";
import type { NavigationGuard } from "next-navigation-guard";
import { useNavigationGuard as useNavigationGuardOriginal } from "next-navigation-guard";

const DEPENDENCIES = {
  useNavigationGuard: useNavigationGuardOriginal,
  usePopup
};

export type UseNavigationGuardOptions = {
  enabled?: boolean;
  message?: string;
  skipWhen?: NavigationGuard;
  dependencies?: typeof DEPENDENCIES;
};

export const useNavigationGuard = ({ enabled, message, skipWhen, dependencies: d = DEPENDENCIES }: UseNavigationGuardOptions = {}) => {
  const { confirm } = d.usePopup();
  const [isToggleEnabled, setIsToggleEnabled] = useState(enabled);
  const isEnabled = useMemo(() => enabled ?? isToggleEnabled, [isToggleEnabled, enabled]);

  d.useNavigationGuard({
    enabled: isEnabled,
    confirm: params => {
      if (skipWhen?.(params)) {
        return true;
      }
      return confirm(message || "You have unsaved changes. Are you sure you want to leave?");
    }
  });

  return useMemo(
    () => ({
      toggle: (options: { hasChanges: boolean } | boolean) => {
        if (typeof enabled === "undefined") {
          setIsToggleEnabled(typeof options === "boolean" ? options : options.hasChanges);
        } else {
          console.warn("can't toggle enabled state when enabled prop is provided");
        }
      }
    }),
    [enabled]
  );
};
