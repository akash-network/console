import { useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { useWhen } from "@src/hooks/useWhen";
import { ApiUserOutput, useAnonymousUserQuery } from "@src/queries/useAnonymousUserQuery";

type UseApiUserResult = {
  user?: ApiUserOutput;
  isLoading: boolean;
};

export const useStoredAnonymousUser = (): UseApiUserResult => {
  const { user: registeredUser, isLoading: isLoadingRegisteredUser } = useCustomUser();
  const [storedAnonymousUser, storeAnonymousUser] = useLocalStorage<ApiUserOutput | undefined>("user", undefined);
  const { user, isLoading } = useAnonymousUserQuery(storedAnonymousUser?.id, { enabled: !registeredUser && !isLoadingRegisteredUser });

  useWhen(user, () => storeAnonymousUser(user));

  return useMemo(
    () => ({
      user,
      isLoading: isLoadingRegisteredUser || isLoading
    }),
    [user, isLoadingRegisteredUser, isLoading]
  );
};
