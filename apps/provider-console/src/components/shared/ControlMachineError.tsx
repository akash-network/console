import React from "react";
import { Alert, AlertDescription, AlertTitle, Spinner } from "@akashnetwork/ui/components";

import { useControlMachine } from "@src/context/ControlMachineProvider";

interface ControlMachineErrorProps {
  onRetry?: () => void;
  customMessage?: string;
  className?: string;
}

export const ControlMachineError: React.FC<ControlMachineErrorProps> = ({ onRetry, customMessage, className }) => {
  const { activeControlMachine, controlMachineLoading } = useControlMachine();

  if (controlMachineLoading) {
    return (
      <Alert className={className}>
        <AlertTitle>Connecting to Control Machine</AlertTitle>
        <AlertDescription className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            <span>Please wait while we check control machine access...</span>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (!activeControlMachine) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTitle>Control Machine Required</AlertTitle>
        <AlertDescription>Please connect your control machine first to start updating pricing settings.</AlertDescription>
      </Alert>
    );
  }

  if (customMessage && onRetry) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTitle>Unable to proceed</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          {customMessage}
          <button onClick={onRetry} className="rounded bg-red-100 px-3 py-1 text-sm text-red-900 hover:bg-red-200">
            Try Again
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};
