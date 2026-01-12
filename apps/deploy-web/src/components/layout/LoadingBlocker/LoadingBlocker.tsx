import React from "react";

import { Loading } from "@src/components/layout/Layout";
import type { FCWithChildren } from "@src/types/component";

interface LoadingBlockerProps {
  isLoading: boolean;
  testId?: string;
  text?: string;
}

export const LoadingBlocker: FCWithChildren<LoadingBlockerProps> = ({ children, isLoading, testId, text }) => {
  return isLoading ? <Loading text={text || ""} testId={testId} /> : <>{children}</>;
};
