import type { IVariant } from "@unleash/nextjs/client";
import { useVariant as useVariantOriginal } from "@unleash/nextjs/client";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { FeatureFlag } from "@src/types/feature-flags";

const useDummyVariant = () => ({
  enabled: false,
  payload: { type: "json", value: JSON.stringify({ message: "dummy-message", date: "2025-03-12T16:03:00.000Z" }) }
});

export const useVariant: FeatureVariantHook = browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? useDummyVariant : useVariantOriginal;
type FeatureVariantHook = (flag: FeatureFlag) => Partial<IVariant>;
