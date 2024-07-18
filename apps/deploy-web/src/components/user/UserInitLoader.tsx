import React from "react";

import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import { useCustomUser } from "@src/hooks/useCustomUser";
import type { FCWithChildren } from "@src/types/component";

export const UserInitLoader: FCWithChildren = ({ children }) => {
  const { isLoading } = useCustomUser();

  return <LoadingBlocker isLoading={isLoading}>{children}</LoadingBlocker>;
};
