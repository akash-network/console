import { validateStaticEnvVars } from "./env-config.schema";

export const browserEnvConfig = validateStaticEnvVars({
  VITE_DEFAULT_NETWORK_ID: import.meta.env.VITE_DEFAULT_NETWORK_ID,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_NODE_ENV: import.meta.env.VITE_NODE_ENV || import.meta.env.MODE,
  VITE_BASE_API_TESTNET_URL: import.meta.env.VITE_BASE_API_TESTNET_URL,
  VITE_BASE_API_SANDBOX_URL: import.meta.env.VITE_BASE_API_SANDBOX_URL,
  VITE_BASE_API_MAINNET_URL: import.meta.env.VITE_BASE_API_MAINNET_URL,
  VITE_LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL,
  VITE_UNLEASH_ENABLE_ALL: import.meta.env.VITE_UNLEASH_ENABLE_ALL,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  VITE_SENTRY_ENABLED: import.meta.env.VITE_SENTRY_ENABLED,
  VITE_GA_MEASUREMENT_ID: import.meta.env.VITE_GA_MEASUREMENT_ID
});
