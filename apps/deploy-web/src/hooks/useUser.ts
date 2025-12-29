import { useMemo } from "react";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { useStoredAnonymousUser } from "@src/hooks/useStoredAnonymousUser";
import type { CustomUserProfile } from "@src/types/user";

export const useUser = (): {
  user: CustomUserProfile;
  isLoading: boolean;
  checkSession: () => Promise<void>;
} => {
  const { user: registeredUser, isLoading: isLoadingRegisteredUser, checkSession } = useCustomUser();
  const { user: anonymousUser, isLoading: isLoadingAnonymousUser } = useStoredAnonymousUser();
  const user = useMemo(() => registeredUser || anonymousUser, [registeredUser, anonymousUser]);
  const isLoading = useMemo(() => isLoadingRegisteredUser || isLoadingAnonymousUser, [isLoadingRegisteredUser, isLoadingAnonymousUser]);

  return {
    user,
    isLoading,
    checkSession
  };
};

export const useIsRegisteredUser = () => {
  const { isLoading, user } = useUser();

  return {
    isLoading,
    canVisit: !!user.userId
  };
};
