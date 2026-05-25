"use client";
import type { ReactNode } from "react";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@akashnetwork/ui/components";

import { Title } from "../shared/Title";

type Props = {
  children?: ReactNode;
  title: string;
  titleId?: string;
  headerActions?: ReactNode;
};

export const SettingsLayout: React.FunctionComponent<Props> = ({ children, title, titleId, headerActions }) => {
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center py-4">
        <Title id={titleId}>{title}</Title>
        {headerActions}
      </div>

      <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
    </>
  );
};
