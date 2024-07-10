import { useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { envConfig } from "@src/config/env.config";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useWhen } from "@src/hooks/useWhen";
import { useAnonymousUserQuery, UserOutput } from "@src/queries/useAnonymousUserQuery";

type UseApiUserResult = {
  user?: UserOutput;
  isLoading: boolean;
};

export const useStoredAnonymousUser = (): UseApiUserResult => {
  const { user: registeredUser, isLoading: isLoadingRegisteredUser } = useCustomUser();
  const [storedAnonymousUser, storeAnonymousUser] = useLocalStorage<UserOutput | undefined>("user", undefined);
  const { user, isLoading } = useAnonymousUserQuery(storedAnonymousUser?.id, {
    enabled: envConfig.NEXT_PUBLIC_BILLING_ENABLED && !registeredUser && !isLoadingRegisteredUser
  });

  useWhen(user, () => storeAnonymousUser(user));

  return useMemo(
    () => ({
      user,
      isLoading: isLoadingRegisteredUser || isLoading
    }),
    [user, isLoadingRegisteredUser, isLoading]
  );
};
