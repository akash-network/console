import { FlagProvider as FlagProviderOriginal } from "@unleash/nextjs";

import { browserEnvConfig } from "@src/config/browser-env.config";

const DummyFlagProvider: typeof FlagProviderOriginal = props => <>{props.children}</>;

export const FlagProvider = browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? DummyFlagProvider : FlagProviderOriginal;
