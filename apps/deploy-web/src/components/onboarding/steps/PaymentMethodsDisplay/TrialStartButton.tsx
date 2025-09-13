import React from "react";
import { LoadingButton } from "@akashnetwork/ui/components";

interface TrialStartButtonProps {
  isLoading: boolean;
  disabled: boolean;
  onClick: () => void;
}

export const TrialStartButton: React.FC<TrialStartButtonProps> = ({ isLoading, disabled, onClick }) => (
  <div className="mx-auto flex max-w-md justify-center">
    <LoadingButton onClick={onClick} disabled={disabled} loading={isLoading} className="flex w-full items-center gap-2">
      {isLoading ? "Starting Trial..." : "Start Trial"}
    </LoadingButton>
  </div>
);
