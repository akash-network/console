import { FlagProvider as FlagProviderOriginal } from "@unleash/nextjs";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useUser } from "@src/hooks/useUser";
import type { FCWithChildren } from "@src/types/component";

const DummyFlagProvider: typeof FlagProviderOriginal = props => <>{props.children}</>;

const COMPONENTS = {
  FlagProvider: FlagProviderOriginal,
  useUser
};

export type Props = { components?: typeof COMPONENTS };

export const UserAwareFlagProvider: FCWithChildren<Props> = ({ children, components: c = COMPONENTS }) => {
  const { user } = c.useUser();
  return <c.FlagProvider config={{ context: { userId: user?.id } }}>{children}</c.FlagProvider>;
};

export const FlagProvider = browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? DummyFlagProvider : UserAwareFlagProvider;
