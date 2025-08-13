import { useMemo } from "react";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { useStoredAnonymousUser } from "@src/hooks/useStoredAnonymousUser";
import type { CustomUserProfile } from "@src/types/user";

export const useUser = (): CustomUserProfile => {
  const { user: registeredUser } = useCustomUser();
  const { user: anonymousUser } = useStoredAnonymousUser();
  const user = useMemo(() => registeredUser || anonymousUser, [registeredUser, anonymousUser]);

  return user;
};

export const useIsRegisteredUser = () => {
  const user = useUser();
  return !!user?.userId;
};
