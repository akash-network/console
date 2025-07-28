import { useFlag as useFlagOriginal } from "@unleash/nextjs/client";

import { browserEnvConfig } from "@src/config/browser-env.config";

const useDummyFlag: FeatureFlagHook = () => true;

export type FeatureFlag =
  | "alerts" // keep new line
  | "anonymous_free_trial"
  | "notifications_general_alerts_update"
  | "ui_deployment_closed_alert"
  | "billing_usage";
export const useFlag: FeatureFlagHook = browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? useDummyFlag : useFlagOriginal;
type FeatureFlagHook = (flag: FeatureFlag) => boolean;
