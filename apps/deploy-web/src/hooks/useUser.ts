import { useEffect, useMemo } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useStoredAnonymousUser } from "@src/hooks/useStoredAnonymousUser";
import type { CustomUserProfile } from "@src/types/user";

export const useUser = (): CustomUserProfile => {
  const { user: registeredUser } = useCustomUser();
  const { user: anonymousUser } = useStoredAnonymousUser();
  const user = useMemo(() => registeredUser || anonymousUser, [registeredUser, anonymousUser]);
  const { analyticsService } = useServices();

  useEffect(() => {
    if (user?.id) {
      analyticsService.identify({
        id: user.id,
        anonymous: !user.userId,
        emailVerified: !!user.emailVerified
      });
    }
  }, [user, analyticsService]);

  return user;
};

export const useIsRegisteredUser = () => {
  const user = useUser();
  return !!user?.userId;
};
