import { useMemo } from "react";

import { useCustomUser } from "@src/hooks/useCustomUser";
import type { CustomUserProfile } from "@src/types/user";

export const useUser = (): {
  user: CustomUserProfile;
  isLoading: boolean;
  checkSession: () => Promise<void>;
} => {
  const { user: registeredUser, isLoading: isLoadingRegisteredUser, checkSession } = useCustomUser();
  const user = useMemo(() => registeredUser, [registeredUser]);
  const isLoading = useMemo(() => isLoadingRegisteredUser, [isLoadingRegisteredUser]);

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
