import React from "react";

import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import { useStoredAnonymousUser } from "@src/hooks/useStoredAnonymousUser";
import type { UserOutput } from "@src/queries/useAnonymousUserQuery";
import type { FCWithChildren } from "@src/types/component";

interface IAnonymousUserContext {
  user?: UserOutput;
}

const AnonymousUserContext = React.createContext<IAnonymousUserContext>({});

export const AnonymousUserProvider: FCWithChildren = ({ children }) => {
  const { user, isLoading } = useStoredAnonymousUser();

  return (
    <LoadingBlocker isLoading={isLoading}>
      <AnonymousUserContext.Provider value={{ user }}>{children}</AnonymousUserContext.Provider>
    </LoadingBlocker>
  );
};

export const useAnonymousUser = () => React.useContext(AnonymousUserContext);
