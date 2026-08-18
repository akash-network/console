import { useMemo } from "react";

import { useCustomUser } from "@src/hooks/useCustomUser";
import type { CustomUserProfile } from "@src/types/user";

export const useUser = (): {
  user: CustomUserProfile | undefined;
  isLoading: boolean;
  error: Error | undefined;
  checkSession: () => Promise<void>;
} => {
  const { user: registeredUser, isLoading: isLoadingRegisteredUser, error, checkSession } = useCustomUser();
  const user = useMemo(() => registeredUser, [registeredUser]);
  const isLoading = useMemo(() => isLoadingRegisteredUser, [isLoadingRegisteredUser]);

  return {
    user,
    isLoading,
    error,
    checkSession
  };
};
