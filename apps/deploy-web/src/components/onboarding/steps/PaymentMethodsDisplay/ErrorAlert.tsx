import React from "react";
import { Alert } from "@akashnetwork/ui/components";
import { WarningTriangle } from "iconoir-react";

import type { AppError } from "@src/types";
import { extractErrorMessage } from "@src/utils/errorUtils";

interface ErrorAlertProps {
  error?: AppError;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ error }) => {
  if (!error) return null;

  return (
    <Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="destructive">
      <div className="flex-shrink-0 rounded-full bg-card p-3">
        <WarningTriangle className="h-6 w-6" />
      </div>
      <div>
        <h4 className="font-medium">Failed to Start Trial</h4>
        <p className="text-sm">{extractErrorMessage(error)}</p>
      </div>
    </Alert>
  );
};
