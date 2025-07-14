"use client";

import type { ReactNode } from "react";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@akashnetwork/ui/components";

import { Title } from "@src/components/shared/Title";

type Props = {
  children?: ReactNode;
};

export const BillingUsageLayout: React.FunctionComponent<Props> = ({ children }) => {
  return (
    <>
      <Title className="mb-4">Billing & Usage</Title>
      <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
    </>
  );
};
