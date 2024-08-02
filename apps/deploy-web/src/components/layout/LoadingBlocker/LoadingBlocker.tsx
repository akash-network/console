import React from "react";

import { Loading } from "@src/components/layout/Layout";
import type { FCWithChildren } from "@src/types/component";

interface LoadingBlockerProps {
  isLoading: boolean;
}

export const LoadingBlocker: FCWithChildren<LoadingBlockerProps> = ({ children, isLoading }) => {
  return isLoading ? <Loading text="" /> : <>{children}</>;
};
