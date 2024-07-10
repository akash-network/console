import { UserProvider } from "@auth0/nextjs-auth0/client";

import { UserInitLoader } from "@src/components/user/UserInitLoader";
import { envConfig } from "@src/config/env.config";
import { AnonymousUserProvider } from "@src/context/AnonymousUserProvider/AnonymousUserProvider";
import { FCWithChildren } from "@src/types/component";

export const UserProviders: FCWithChildren = ({ children }) =>
  envConfig.NEXT_PUBLIC_BILLING_ENABLED ? (
    <UserProvider>
      <UserInitLoader>
        <AnonymousUserProvider>{children}</AnonymousUserProvider>
      </UserInitLoader>
    </UserProvider>
  ) : (
    <UserProvider>{children}</UserProvider>
  );
