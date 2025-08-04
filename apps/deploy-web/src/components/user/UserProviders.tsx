import { UserProvider } from "@auth0/nextjs-auth0/client";

import { UserInitLoader } from "@src/components/user/UserInitLoader";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { AnonymousUserProvider } from "@src/context/AnonymousUserProvider/AnonymousUserProvider";
import { useServices } from "@src/context/ServicesProvider";
import type { FCWithChildren } from "@src/types/component";

/**
 * UserProviders is a client only component because it uses the UserProvider
 * which is a client only component.
 */
export const UserProviders: FCWithChildren = ({ children }) => {
  const { internalApiHttpClient } = useServices();
  return browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED ? (
    <UserProvider fetcher={url => internalApiHttpClient.get(url).then(response => response.data)}>
      <UserInitLoader>
        <AnonymousUserProvider>{children}</AnonymousUserProvider>
      </UserInitLoader>
    </UserProvider>
  ) : (
    <UserProvider>{children}</UserProvider>
  );
};
