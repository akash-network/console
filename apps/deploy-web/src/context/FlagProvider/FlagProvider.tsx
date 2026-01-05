import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { FlagProvider as FlagProviderOriginal, useUnleashClient } from "@unleash/nextjs";

import { Loading } from "@src/components/layout/Layout";
import { useUser } from "@src/hooks/useUser";
import type { FCWithChildren } from "@src/types/component";
import { useServices } from "../ServicesProvider";

const COMPONENTS = {
  FlagProvider: FlagProviderOriginal,
  useUser,
  WaitForFeatureFlags
};

export type Props = { components?: typeof COMPONENTS };

export const UserAwareFlagProvider: FCWithChildren<Props> = ({ children, components: c = COMPONENTS }) => {
  const { publicConfig } = useServices();
  const { user } = c.useUser();
  const isEnableAll = publicConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL;

  return (
    <c.FlagProvider
      config={{
        context: {
          userId: user?.id,
          sessionId: getSessionId()
        },
        fetch: isEnableAll ? () => new Response(JSON.stringify({ toggles: [] })) : undefined
      }}
    >
      <c.WaitForFeatureFlags>{children}</c.WaitForFeatureFlags>
    </c.FlagProvider>
  );
};

export const FlagProvider = UserAwareFlagProvider;

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
    return <Loading text="Loading application..." />;
  }
  return <>{children}</>;
}

function getSessionId(): string | undefined {
  const m = document.cookie.match(/(?:^|; )unleash-session-id=([^;]+)/);
  return m?.[1];
}
