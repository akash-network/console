import { useMemo } from "react";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { useStoredAnonymousUser } from "@src/hooks/useStoredAnonymousUser";
import type { CustomUserProfile } from "@src/types/user";

export const useUser = (): CustomUserProfile & { isLoading: boolean } => {
  const { user: registeredUser, isLoading: isLoadingRegisteredUser } = useCustomUser();
  const { user: anonymousUser, isLoading: isLoadingAnonymousUser } = useStoredAnonymousUser();
  const user = useMemo(() => registeredUser || anonymousUser || {}, [registeredUser, anonymousUser]);
  const isLoading = useMemo(() => isLoadingRegisteredUser || isLoadingAnonymousUser, [isLoadingRegisteredUser, isLoadingAnonymousUser]);

  return {
    ...user,
    isLoading
  };
};

export const useIsRegisteredUser = () => {
  const { isLoading, userId } = useUser();

  return {
    isLoading,
    canVisit: !!userId
  };
};
