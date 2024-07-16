import { useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { useWhen } from "@src/hooks/useWhen";
import { ApiUserOutput, useAnonymousUserQuery } from "@src/queries/useAnonymousUserQuery";

type UseApiUserResult = {
  user?: ApiUserOutput;
  isLoading: boolean;
  error?: unknown;
};

export const useAnonymousUser = (): UseApiUserResult => {
  const { user: registeredUser, isLoading: isLoadingRegisteredUser } = useCustomUser();
  // TODO: investigate persistence on react query level
  const [storedAnonymousUser, storeAnonymousUser] = useLocalStorage<ApiUserOutput | undefined>("user", undefined);
  const { findOrCreate, data: anonymousUser, isLoading: isLoadingAnonymousUser, error } = useAnonymousUserQuery(storedAnonymousUser?.id);

  useWhen(!registeredUser && !isLoadingRegisteredUser, () => {
    findOrCreate();
  });
  useWhen(anonymousUser && !storedAnonymousUser, () => storeAnonymousUser(anonymousUser));

  return useMemo(
    () => ({
      user: anonymousUser,
      isLoading: isLoadingAnonymousUser,
      error
    }),
    [anonymousUser, isLoadingAnonymousUser, error]
  );
};
