import { useFlag as useFlagOriginal } from "@unleash/nextjs/client";

import { useServices } from "@src/context/ServicesProvider";
import type { FeatureFlag } from "@src/types/feature-flags";

const useDummyFlag: FeatureFlagHook = () => true;

export const useFlag: FeatureFlagHook = flag => {
  const { publicConfig } = useServices();
  const useHook = publicConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? useDummyFlag : useFlagOriginal;
  return useHook(flag);
};

type FeatureFlagHook = (flag: FeatureFlag) => boolean;
