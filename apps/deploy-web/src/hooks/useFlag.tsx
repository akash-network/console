import { useFlag as useFlagOriginal } from "@unleash/nextjs/client";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { FeatureFlag } from "@src/types/feature-flags";

const useDummyFlag: FeatureFlagHook = () => true;

export const useFlag: FeatureFlagHook = browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? useDummyFlag : useFlagOriginal;
type FeatureFlagHook = (flag: FeatureFlag) => boolean;
