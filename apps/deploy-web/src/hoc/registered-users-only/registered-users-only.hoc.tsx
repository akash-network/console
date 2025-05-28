import React from "react";

import { useUser } from "@src/hooks/useUser";
import FourOhFour from "@src/pages/404";

export const RegisteredUsersOnly = <P extends object>(Component: React.ComponentType<P>, FallbackComponent = FourOhFour) => {
  const WithRegisteredUsersOnly = (props: P) => {
    const user = useUser();

    const isRegistered = !!user?.userId;
    if (isRegistered) {
      return <Component {...props} />;
    }

    return <FallbackComponent />;
  };

  const displayName = Component.displayName || Component.name || "Component";
  WithRegisteredUsersOnly.displayName = `RegisteredUsersOnly(${displayName})`;

  return WithRegisteredUsersOnly;
};
