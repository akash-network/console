import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { FlagProvider as FlagProviderOriginal, useUnleashClient } from "@unleash/nextjs";

import { BootLoading } from "@src/context/BootLoadingProvider/BootLoadingProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import type { FCWithChildren } from "@src/types/component";

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

    const stopWaiting = () => {
      clearTimeout(timerId);
      client.off("ready", markReady);
      client.off("error", markReady);
    };
    const markReady = () => {
      stopWaiting();
      setIsReady(true);
    };
    const timerId = setTimeout(markReady, UNLEASH_READY_TIMEOUT_MS);
    client.on("ready", markReady);
    client.on("error", markReady);

    return stopWaiting;
  }, [client]);

  if (!isReady) {
    return <BootLoading />;
  }
  return <>{children}</>;
}

function getSessionId(): string | undefined {
  const m = document.cookie.match(/(?:^|; )unleash-session-id=([^;]+)/);
  return m?.[1];
}
