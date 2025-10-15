import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { FlagProvider as FlagProviderOriginal, useUnleashClient } from "@unleash/nextjs";

import { browserEnvConfig } from "../../config/browser-env.config";

const DummyFlagProvider: typeof FlagProviderOriginal = props => <>{props.children}</>;

const COMPONENTS = {
  FlagProvider: FlagProviderOriginal,
  WaitForFeatureFlags
};

export type Props = { components?: typeof COMPONENTS };

const UnleashFlagProvider: FC<Props & { children: React.ReactNode }> = ({ children, components: c = COMPONENTS }) => {
  return (
    <c.FlagProvider>
      <c.WaitForFeatureFlags>{children}</c.WaitForFeatureFlags>
    </c.FlagProvider>
  );
};

export const FlagProvider = browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? DummyFlagProvider : UnleashFlagProvider;

function WaitForFeatureFlags({ children }: { children: ReactNode }) {
  const client = useUnleashClient();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isReady !== client.isReady()) {
      setIsReady(client.isReady());
    }

    let callback: (() => void) | undefined;
    if (!client.isReady()) {
      callback = () => setIsReady(true);
      client.once("ready", callback);
    }

    return () => {
      if (callback) client.off("ready", callback);
    };
  }, [client, isReady]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size="large" />
      </div>
    );
  }
  return <>{children}</>;
}
