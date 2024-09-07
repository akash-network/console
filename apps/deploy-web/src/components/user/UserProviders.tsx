import { UserProvider } from "@auth0/nextjs-auth0/client";

import { UserInitLoader } from "@src/components/user/UserInitLoader";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { AnonymousUserProvider } from "@src/context/AnonymousUserProvider/AnonymousUserProvider";
import { authHttpService } from "@src/services/user/user-http.service";
import { FCWithChildren } from "@src/types/component";

export const UserProviders: FCWithChildren = ({ children }) =>
  browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED ? (
    <UserProvider fetcher={authHttpService.getProfile}>
      <UserInitLoader>
        <AnonymousUserProvider>{children}</AnonymousUserProvider>
      </UserInitLoader>
    </UserProvider>
  ) : (
    <UserProvider>{children}</UserProvider>
  );
