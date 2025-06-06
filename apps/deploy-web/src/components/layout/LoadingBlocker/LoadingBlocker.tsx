import React from "react";

import { Loading } from "@src/components/layout/Layout";
import type { FCWithChildren } from "@src/types/component";

interface LoadingBlockerProps {
  isLoading: boolean;
  testId?: string;
}

export const LoadingBlocker: FCWithChildren<LoadingBlockerProps> = ({ children, isLoading, testId }) => {
  return isLoading ? <Loading text="" testId={testId} /> : <>{children}</>;
};
