import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { FlagProvider as FlagProviderOriginal, useUnleashClient } from "@unleash/nextjs";

import { browserEnvConfig } from "../../config/browser-env.config";

const COMPONENTS = {
  FlagProvider: FlagProviderOriginal,
  WaitForFeatureFlags
};

export type Props = { components?: typeof COMPONENTS };

const UnleashFlagProvider: FC<Props & { children: React.ReactNode }> = ({ children, components: c = COMPONENTS }) => {
  return (
    <c.FlagProvider
      config={{
        fetch: browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? () => new Response(JSON.stringify({ toggles: [] })) : undefined
      }}
    >
      <c.WaitForFeatureFlags>{children}</c.WaitForFeatureFlags>
    </c.FlagProvider>
  );
};

export const FlagProvider = UnleashFlagProvider;

function WaitForFeatureFlags({ children }: { children: ReactNode }) {
  const client = useUnleashClient();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (client.isReady()) {
      setIsReady(true);
      return;
    }

    let callback: (() => void) | undefined;
    if (!client.isReady()) {
      callback = () => {
        if (timerId) clearTimeout(timerId);
        setIsReady(true);
      };
      const timerId = setTimeout(callback, 10_000);
      client.once("ready", callback);
      client.once("error", callback);
    }

    return () => {
      if (callback) {
        client.off("ready", callback);
        client.off("error", callback);
      }
    };
  }, [client]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size="large" />
      </div>
    );
  }
  return <>{children}</>;
}
