"use client";
import { ReactNode } from "react";
import { FallbackProps } from "react-error-boundary";

import { Alert, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";

interface Props extends FallbackProps {
  children?: ReactNode;
}

export const ErrorFallback: React.FunctionComponent<Props> = ({ error, resetErrorBoundary }) => {
  return (
    <div className="flex h-full max-w-[300px] mx-auto flex-col py-8" role="alert">
      <h1 className="mb-6 text-2xl font-bold">Something went wrong</h1>

      <Alert variant="destructive" className="mb-8 text-left">
        <AlertTitle>Error</AlertTitle>
        {error.message}
      </Alert>

      <Button variant="default" type="button" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
};
