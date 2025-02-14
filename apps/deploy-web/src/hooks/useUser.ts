import { useEffect, useMemo } from "react";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { useStoredAnonymousUser } from "@src/hooks/useStoredAnonymousUser";
import { analyticsService } from "@src/services/analytics/analytics.service";
import { CustomUserProfile } from "@src/types/user";

export const useUser = (): CustomUserProfile => {
  const { user: registeredUser } = useCustomUser();
  const { user: anonymousUser } = useStoredAnonymousUser();

  const user = useMemo(() => registeredUser || anonymousUser, [registeredUser, anonymousUser]);

  useEffect(() => {
    if (user?.id) {
      analyticsService.identify({
        id: user.id,
        anonymous: !user.userId,
        emailVerified: !!user.emailVerified
      });
    }
  }, [user]);

  return user;
};
