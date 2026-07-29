import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { FlagProvider as FlagProviderOriginal, useUnleashClient } from "@unleash/nextjs";

import { Loading } from "@src/components/layout/Layout";
import { useUser } from "@src/hooks/useUser";
import type { FCWithChildren } from "@src/types/component";
import { useServices } from "../ServicesProvider";

const COMPONENTS = {
  FlagProvider: FlagProviderOriginal,
  useUser
};

export type Props = { components?: typeof COMPONENTS };

export const FlagProvider: FCWithChildren<Props> = ({ children, components: c = COMPONENTS }) => {
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
      {children}
    </c.FlagProvider>
  );
};

/** Fail open with default flag values if Unleash never answers, rather than block the app forever. */
export const UNLEASH_READY_TIMEOUT_MS = 10_000;

export const WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES = {
  useUnleashClient
};

export function WaitForFeatureFlags({
  children,
  dependencies: d = WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES
}: {
  children: ReactNode;
  dependencies?: typeof WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES;
}) {
  const client = d.useUnleashClient();
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
      const timerId = setTimeout(callback, UNLEASH_READY_TIMEOUT_MS);
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
    return <Loading text="" />;
  }
  return <>{children}</>;
}

function getSessionId(): string | undefined {
  const m = document.cookie.match(/(?:^|; )unleash-session-id=([^;]+)/);
  return m?.[1];
}
