/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_NETWORK_ID: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_NODE_ENV: string;
  readonly VITE_BASE_API_TESTNET_URL: string;
  readonly VITE_BASE_API_SANDBOX_URL: string;
  readonly VITE_BASE_API_MAINNET_URL: string;
  readonly VITE_LOG_LEVEL: string;
  readonly VITE_UNLEASH_ENABLE_ALL: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_SENTRY_ENABLED: string;
  readonly VITE_GA_MEASUREMENT_ID: string;
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
