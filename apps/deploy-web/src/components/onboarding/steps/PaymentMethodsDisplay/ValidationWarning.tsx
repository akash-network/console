import React from "react";
import { Alert } from "@akashnetwork/ui/components";
import { WarningTriangle } from "iconoir-react";

interface ValidationWarningProps {
  show: boolean;
}

export const ValidationWarning: React.FC<ValidationWarningProps> = ({ show }) => {
  if (!show) return null;

  return (
    <Alert className="mx-auto max-w-md text-left" variant="warning">
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-card p-3">
          <WarningTriangle className="h-4 w-4" />
        </div>
        <div>
          <h4 className="font-medium">Card Validation Required</h4>
          <p className="text-sm">
            You must complete the card validation process before starting your trial. Please wait for the validation to complete or try adding a different card.
          </p>
        </div>
      </div>
    </Alert>
  );
};
