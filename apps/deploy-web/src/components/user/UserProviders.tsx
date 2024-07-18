import { UserProvider } from "@auth0/nextjs-auth0/client";

import { UserInitLoader } from "@src/components/user/UserInitLoader";
import { AnonymousUserProvider } from "@src/context/AnonymousUserProvider/AnonymousUserProvider";
import { FCWithChildren } from "@src/types/component";

export const UserProviders: FCWithChildren = ({ children }) => (
  <UserProvider>
    <UserInitLoader>
      <AnonymousUserProvider>{children}</AnonymousUserProvider>
    </UserInitLoader>
  </UserProvider>
);
