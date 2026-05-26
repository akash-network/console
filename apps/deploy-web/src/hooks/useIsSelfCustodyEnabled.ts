import { useFlag } from "@src/hooks/useFlag";
import type { FeatureFlag } from "@src/types/feature-flags";

export const SELF_CUSTODY_FLAG = "self_custody" satisfies FeatureFlag;

export const DEPENDENCIES = {
  useFlag
};

export const useIsSelfCustodyEnabled = (dependencies: typeof DEPENDENCIES = DEPENDENCIES): boolean => {
  return dependencies.useFlag(SELF_CUSTODY_FLAG);
};
