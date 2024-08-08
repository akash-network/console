import { useMemo } from "react";

import { envConfig } from "@src/config/env.config";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useWhen } from "@src/hooks/useWhen";
import { useAnonymousUserQuery, UserOutput } from "@src/queries/useAnonymousUserQuery";
import { ANONYMOUS_USER_KEY, ANONYMOUS_USER_TOKEN_KEY } from "@src/utils/constants";

type UseApiUserResult = {
  user?: UserOutput;
  isLoading: boolean;
};

const storedAnonymousUserStr = typeof window !== "undefined" && localStorage.getItem(ANONYMOUS_USER_KEY);
const storedAnonymousUser: UserOutput | undefined = storedAnonymousUserStr ? JSON.parse(storedAnonymousUserStr) : undefined;

export const useStoredAnonymousUser = (): UseApiUserResult => {
  const { user: registeredUser, isLoading: isLoadingRegisteredUser } = useCustomUser();
  const { user, isLoading, token } = useAnonymousUserQuery(storedAnonymousUser?.id, {
    enabled: envConfig.NEXT_PUBLIC_BILLING_ENABLED && !registeredUser && !isLoadingRegisteredUser
  });

  useWhen(user, () => localStorage.setItem("anonymous-user", JSON.stringify(user)));
  useWhen(registeredUser?.id, () => {
    localStorage.removeItem(ANONYMOUS_USER_KEY);
    localStorage.removeItem(ANONYMOUS_USER_TOKEN_KEY);
  });
  useWhen(token, () => {
    if (token) {
      localStorage.setItem(ANONYMOUS_USER_TOKEN_KEY, token);
    }
  });

  return useMemo(
    () => ({
      user,
      isLoading: isLoadingRegisteredUser || isLoading
    }),
    [user, isLoadingRegisteredUser, isLoading]
  );
};
