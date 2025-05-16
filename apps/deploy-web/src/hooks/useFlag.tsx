import { useFlag as useFlagOriginal } from "@unleash/nextjs/client";

import { browserEnvConfig } from "@src/config/browser-env.config";

export const useFlag: typeof useFlagOriginal = name => {
  const flagValue = useFlagOriginal(name);
  return browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL || flagValue;
};
