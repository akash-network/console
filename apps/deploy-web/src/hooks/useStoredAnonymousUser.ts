import { useMemo } from "react";

import { ANONYMOUS_USER_KEY, ANONYMOUS_USER_TOKEN_KEY } from "@src/config/auth.config";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useWhen } from "@src/hooks/useWhen";
import { useAnonymousUserQuery, UserOutput } from "@src/queries/useAnonymousUserQuery";

type UseApiUserResult = {
  user?: UserOutput;
  isLoading: boolean;
};

const storedAnonymousUserStr = typeof window !== "undefined" && localStorage.getItem(ANONYMOUS_USER_KEY);
const storedAnonymousUser: UserOutput | undefined = storedAnonymousUserStr ? JSON.parse(storedAnonymousUserStr) : undefined;

export const useStoredAnonymousUser = (): UseApiUserResult => {
  const { user: registeredUser, isLoading: isLoadingRegisteredUser } = useCustomUser();
  const { user, isLoading, token, error } = useAnonymousUserQuery(storedAnonymousUser?.id, {
    enabled: browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED && !registeredUser && !isLoadingRegisteredUser
  });

  useWhen(storedAnonymousUser && !storedAnonymousUser.userId && error && "status" in error && error.status === 401, () => {
    localStorage.removeItem(ANONYMOUS_USER_KEY);
    localStorage.removeItem(ANONYMOUS_USER_TOKEN_KEY);
    window.location.reload();
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
