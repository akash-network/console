import { useFlag as useFlagOriginal } from "@unleash/nextjs/client";

import { browserEnvConfig } from "@src/config/browser-env.config";

const useDummyFlag: FeatureFlagHook = () => true;

export type FeatureFlag =
  // keep new line
  "alerts" | "console_web_anonymous_user_trial";
export const useFlag: FeatureFlagHook = browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? useDummyFlag : useFlagOriginal;
type FeatureFlagHook = (flag: FeatureFlag) => boolean;
