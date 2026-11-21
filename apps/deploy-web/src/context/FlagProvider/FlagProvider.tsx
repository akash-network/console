import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { IToggle } from "@unleash/nextjs";
import { FlagProvider as FlagProviderOriginal, useUnleashClient } from "@unleash/nextjs";

import { BootLoading } from "@src/context/BootLoadingProvider/BootLoadingProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import type { FCWithChildren } from "@src/types/component";

export const FLAG_CONTEXT_USER_SYNC_DEPENDENCIES = {
  useUnleashClient
};

/** The flag client only reads its context when it is built, so a user who signs in later has to be pushed into it. */
export const FlagContextUserSync: FC<{ userId: string | undefined; dependencies?: typeof FLAG_CONTEXT_USER_SYNC_DEPENDENCIES }> = ({
  userId,
  dependencies: d = FLAG_CONTEXT_USER_SYNC_DEPENDENCIES
}) => {
  const client = d.useUnleashClient();

  useEffect(
    function followSignedInUser() {
      if (client.getContext().userId === userId) return;
      client.updateContext({ userId });
    },
    [client, userId]
  );

  return null;
};

const COMPONENTS = {
  FlagProvider: FlagProviderOriginal,
  FlagContextUserSync,
  useUser
};

export type Props = {
  /** The flags a server render was made under, which the first render in the browser has to repeat before Unleash has answered. */
  bootstrap?: IToggle[];
  components?: typeof COMPONENTS;
};

export const FlagProvider: FCWithChildren<Props> = ({ children, bootstrap, components: c = COMPONENTS }) => {
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
        bootstrap,
        fetch: isEnableAll ? () => new Response(JSON.stringify({ toggles: [] })) : undefined
      }}
    >
      <c.FlagContextUserSync userId={user?.id} />
      {children}
    </c.FlagProvider>
  );
};

/** Fail open with default flag values if Unleash never answers, rather than block the app forever. */
export const UNLEASH_READY_TIMEOUT_MS = 10_000;

export const WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES = {
  useUnleashClient
};

/** Whether Unleash has answered, failed, or run out of time, after which flag values stop changing under the caller. */
export function useFeatureFlagsReady(d: typeof WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES = WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES): boolean {
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

  return isReady;
}

export function WaitForFeatureFlags({
  children,
  isBootstrapped,
  dependencies: d = WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES
}: {
  children: ReactNode;
  /** True when the flags came with the page, so there is nothing to wait for. */
  isBootstrapped?: boolean;
  dependencies?: typeof WAIT_FOR_FEATURE_FLAGS_DEPENDENCIES;
}) {
  const isReady = useFeatureFlagsReady(d);

  if (!isReady && !isBootstrapped) {
    return <BootLoading />;
  }
  return <>{children}</>;
}

function getSessionId(): string | undefined {
  if (typeof document === "undefined") return undefined;

  const m = document.cookie.match(/(?:^|; )unleash-session-id=([^;]+)/);
  return m?.[1];
}
