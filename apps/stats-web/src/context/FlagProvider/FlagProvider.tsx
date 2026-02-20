import type { FC, ReactNode } from "react";

import { browserEnvConfig } from "../../config/browser-env.config";

export type Props = { children: ReactNode };

/**
 * Simplified FlagProvider for Vite SPA.
 * Feature flags can be added back using @unleash/proxy-client-react if needed.
 * For now, we just render children since VITE_UNLEASH_ENABLE_ALL controls this.
 */
export const FlagProvider: FC<Props> = ({ children }) => {
  // In the Vite SPA, we simplify feature flag handling.
  // If you need full Unleash integration, configure the proxy client here.
  if (browserEnvConfig.VITE_UNLEASH_ENABLE_ALL) {
    return <>{children}</>;
  }

  // For now, just render children without feature flag gating
  // This can be expanded with @unleash/proxy-client-react if needed
  return <>{children}</>;
};
