import { useCallback, useEffect } from "react";
import { UserProvider } from "@auth0/nextjs-auth0/client";

import { UserInitLoader } from "@src/components/user/UserInitLoader";
import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import type { FCWithChildren } from "@src/types/component";

/**
 * UserProviders is a client only component because it uses the UserProvider
 * which is a client only component.
 */
export const UserProviders: FCWithChildren = ({ children }) => {
  const { internalApiHttpClient } = useServices();
  const getProfile = useCallback(
    async (url: string) => {
      const response = await internalApiHttpClient.get(url, { validateStatus: status => status < 500 });
      if (response.status === 401) return;
      return response.data;
    },
    [internalApiHttpClient]
  );
  return (
    <UserProvider fetcher={getProfile}>
      <UserInitLoader>
        <UserTracker>{children}</UserTracker>
      </UserInitLoader>
    </UserProvider>
  );
};

const UserTracker: FCWithChildren = ({ children }) => {
  const { user } = useUser();
  const { analyticsService, userTracker } = useServices();

  useEffect(() => {
    userTracker.track(user);
    if (user?.id) {
      analyticsService.identify({
        id: user.id,
        anonymous: !user.userId,
        emailVerified: !!user.emailVerified
      });
    }
  }, [user, analyticsService, userTracker]);

  return <>{children}</>;
};
