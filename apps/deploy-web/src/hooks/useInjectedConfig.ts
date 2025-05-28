import { useEffect, useState } from "react";

import type { BrowserEnvConfig } from "@src/config/env-config.schema";
import { decodeInjectedConfig, hasInjectedConfig } from "@src/services/decodeInjectedConfig/decodeInjectedConfig";

/**
 * This hook is used to get the injected and verified config from the window object.
 */
export function useInjectedConfig({
  decodeConfig = decodeInjectedConfig,
  hasConfig = hasInjectedConfig
}: InjectedConfigHookProps = {}): InjectedConfigHookResult {
  const [isLoaded, setIsLoaded] = useState(false);
  const [config, setConfig] = useState<Partial<BrowserEnvConfig> | null>(null);

  useEffect(() => {
    if (hasConfig()) {
      decodeConfig()
        .then(setConfig)
        .finally(() => setIsLoaded(true));
    } else {
      setIsLoaded(true);
    }
  }, []);

  return { config, isLoaded };
}

/**
 * Cannot use DI in this hook directly because we need to use it at the very beginning of the app
 */
export interface InjectedConfigHookProps {
  decodeConfig?: typeof decodeInjectedConfig;
  hasConfig?: typeof hasInjectedConfig;
}

export interface InjectedConfigHookResult {
  config: Partial<BrowserEnvConfig> | null;
  isLoaded: boolean;
}
