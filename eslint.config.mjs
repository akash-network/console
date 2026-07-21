// @ts-check
import tsConfig from "@akashnetwork/dev-config/eslint/typescript.mjs";

/**
 * Workspaces that own an eslint.config.mjs lint themselves — via their own `lint`
 * script (locally and in CI's `npm run lint -w <workspace>`) and via lint-staged,
 * which resolves each staged file against its owning config. The root config is
 * only the fallback for root-level files and config-less packages, so it must
 * ignore the self-configured workspaces; otherwise a root-cwd `eslint .` would
 * lint them without the rules and parser options their own configs provide
 * (decorator metadata for DI apps, Next.js parity for web apps).
 */
const SELF_CONFIGURED_WORKSPACES = [
  "apps/api/**",
  "apps/deploy-web/**",
  "apps/indexer/**",
  "apps/log-collector/**",
  "apps/notifications/**",
  "apps/provider-console/**",
  "apps/provider-inventory/**",
  "apps/provider-proxy/**",
  "apps/stats-web/**",
  "packages/console-api-types/**",
  "packages/openapi-sdk/**",
  "packages/react-query-proxy/**"
];

export default [
  {
    ignores: [".claude/**", ...SELF_CONFIGURED_WORKSPACES]
  },
  ...tsConfig
];
