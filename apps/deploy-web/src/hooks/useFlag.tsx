import { useFlag as useFlagOriginal } from "@unleash/nextjs/client";

import { browserEnvConfig } from "@src/config/browser-env.config";

const useDummyFlag: typeof useFlagOriginal = () => true;

export const useFlag = browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? useDummyFlag : useFlagOriginal;
