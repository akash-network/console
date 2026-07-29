import React from "react";

import { BootLoading } from "@src/context/BootLoadingProvider/BootLoadingProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import type { FCWithChildren } from "@src/types/component";

export const UserInitLoader: FCWithChildren = ({ children }) => {
  const { isLoading } = useCustomUser();

  if (isLoading) return <BootLoading />;
  return <>{children}</>;
};
