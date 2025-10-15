import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { FlagProvider as FlagProviderOriginal, useUnleashClient } from "@unleash/nextjs";

import { Loading } from "@src/components/layout/Layout";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useUser } from "@src/hooks/useUser";
import type { FCWithChildren } from "@src/types/component";

const DummyFlagProvider: typeof FlagProviderOriginal = props => <>{props.children}</>;

const COMPONENTS = {
  FlagProvider: FlagProviderOriginal,
  useUser,
  WaitForFeatureFlags
};

export type Props = { components?: typeof COMPONENTS };

export const UserAwareFlagProvider: FCWithChildren<Props> = ({ children, components: c = COMPONENTS }) => {
  const { user } = c.useUser();

  return (
    <c.FlagProvider
      config={{
        context: { userId: user?.id }
      }}
    >
      <c.WaitForFeatureFlags>{children}</c.WaitForFeatureFlags>
    </c.FlagProvider>
  );
};

export const FlagProvider = browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? DummyFlagProvider : UserAwareFlagProvider;

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
    return <Loading text="Loading application..." />;
  }
  return <>{children}</>;
}
