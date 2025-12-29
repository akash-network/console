import type { BrowserEnvConfig } from "@src/config/env-config.schema";

export function getInjectedConfig(): Partial<BrowserEnvConfig> | undefined {
  return typeof window !== "undefined" ? (window as any).__AK_INJECTED_CONFIG__ : undefined;
}
