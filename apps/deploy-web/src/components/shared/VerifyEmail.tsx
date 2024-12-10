import { Alert, AlertDescription } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { WarningCircle } from "iconoir-react";

import { useIsEmailVerified } from "@src/hooks/useRequiredEmailVerified";

export const VerifyEmail = ({ className }: { className?: string }) => {
  const isEmailVerified = useIsEmailVerified();

  if (isEmailVerified) return null;

  return (
    <Alert variant="warning" className={className}>
      <AlertDescription className="flex items-center space-x-2">
        <WarningCircle className="text-lg" />
        <span>Verify your email to add funds to your balance.</span>
      </AlertDescription>
    </Alert>
  );
};
