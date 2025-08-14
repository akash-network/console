import { useEffect } from "react";
import { UserProvider } from "@auth0/nextjs-auth0/client";

import { UserInitLoader } from "@src/components/user/UserInitLoader";
import { AnonymousUserProvider } from "@src/context/AnonymousUserProvider/AnonymousUserProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import type { FCWithChildren } from "@src/types/component";

/**
 * UserProviders is a client only component because it uses the UserProvider
 * which is a client only component.
 */
export const UserProviders: FCWithChildren = ({ children }) => {
  const { internalApiHttpClient, appConfig } = useServices();
  return appConfig.NEXT_PUBLIC_BILLING_ENABLED ? (
    <UserProvider fetcher={url => internalApiHttpClient.get(url).then(response => response.data)}>
      <UserInitLoader>
        <AnonymousUserProvider>
          <UserTracker>{children}</UserTracker>
        </AnonymousUserProvider>
      </UserInitLoader>
    </UserProvider>
  ) : (
    <UserProvider>
      <UserTracker>{children}</UserTracker>
    </UserProvider>
  );
};

const UserTracker: FCWithChildren = ({ children }) => {
  const user = useUser();
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
