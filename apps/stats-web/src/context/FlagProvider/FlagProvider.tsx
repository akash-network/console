import type { FC } from "react";
import { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { FlagProvider as FlagProviderOriginal, useUnleashClient } from "@unleash/nextjs";

import { browserEnvConfig } from "../../config/browser-env.config";

const DummyFlagProvider: typeof FlagProviderOriginal = props => <>{props.children}</>;

const COMPONENTS = {
  FlagProvider: FlagProviderOriginal
};

export type Props = { components?: typeof COMPONENTS };

const UnleashFlagProvider: FC<Props & { children: React.ReactNode }> = ({ children, components: c = COMPONENTS }) => {
  return (
    <c.FlagProvider>
      <WaitForFeatureFlags>{children}</WaitForFeatureFlags>
    </c.FlagProvider>
  );
};

export const FlagProvider = browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? DummyFlagProvider : UnleashFlagProvider;

const WaitForFeatureFlags: FC<Props & { children: React.ReactNode }> = ({ children }) => {
  const client = useUnleashClient();
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    client.once("ready", () => {
      setIsReady(true);
    });
  }, [client]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size="large" />
      </div>
    );
  }
  return <>{children}</>;
};
