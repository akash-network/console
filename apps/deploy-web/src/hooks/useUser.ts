import { useMemo } from "react";

import { useCustomUser } from "@src/hooks/useCustomUser";
import type { CustomUserProfile } from "@src/types/user";

export const useUser = (): {
  user: CustomUserProfile;
  isLoading: boolean;
} => {
  const { user, isLoading } = useCustomUser();

  return {
    user,
    isLoading
  };
};

export const useIsRegisteredUser = () => {
  const { isLoading, user } = useUser();

  return {
    isLoading,
    canVisit: !!user.userId
  };
};
