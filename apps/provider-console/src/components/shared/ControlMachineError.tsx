import React from "react";
import { Alert, AlertDescription, AlertTitle, Button, Spinner } from "@akashnetwork/ui/components";

import { useControlMachine } from "@src/context/ControlMachineProvider";

interface ControlMachineErrorProps {
  onRetry?: () => void;
  customMessage?: string;
  className?: string;
  activity?: string;
}

export const ControlMachineError: React.FC<ControlMachineErrorProps> = ({ onRetry, customMessage, className, activity = "settings" }) => {
  const { activeControlMachine, controlMachineLoading, openControlMachineDrawer } = useControlMachine();

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
        <AlertTitle className="text-red-600 dark:text-red-100">Control Machine Connection Required</AlertTitle>
        <AlertDescription className="text-red-500 dark:text-red-200">
          Please
          <Button onClick={openControlMachineDrawer} variant="link" className="pl-1 pr-0">
            Connect
          </Button>{" "}
          your control machine first to start updating {activity}.
        </AlertDescription>
      </Alert>
    );
  }

  if (customMessage && onRetry) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTitle className="text-red-100">Unable to proceed</AlertTitle>
        <AlertDescription className="flex items-center justify-between text-red-200">
          {customMessage}
          <button onClick={onRetry} className="rounded bg-red-900 px-3 py-1 text-sm text-red-100 hover:bg-red-800">
            Try Again
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};
