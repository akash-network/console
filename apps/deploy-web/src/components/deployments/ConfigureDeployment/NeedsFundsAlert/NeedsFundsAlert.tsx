import type { FC } from "react";
import { Alert, AlertDescription, AlertTitle, Button } from "@akashnetwork/ui/components";
import { TriangleAlertIcon } from "lucide-react";

import type { DepositShortfall } from "../depositShortfall/depositShortfall";
import { describeDepositShortfall } from "../depositShortfall/depositShortfall";

const NEEDS_FUNDS_FALLBACK_MESSAGE = "Your balance doesn't cover this deployment yet. Add credits, then try again.";

type Props = {
  message?: string;
  shortfall?: DepositShortfall;
  onAddCredits: () => void;
  onTryAgain: () => void;
};

export const NeedsFundsAlert: FC<Props> = ({ message, shortfall, onAddCredits, onTryAgain }) => (
  <Alert variant="warning" className="p-4">
    <TriangleAlertIcon className="h-4 w-4" aria-hidden="true" />
    <div className="flex flex-col gap-3 text-foreground">
      <div>
        <AlertTitle>Add credits to deploy</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          {shortfall ? describeDepositShortfall(shortfall) : message ?? NEEDS_FUNDS_FALLBACK_MESSAGE}
        </AlertDescription>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="sm" onClick={onAddCredits}>
          Add credits
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onTryAgain}>
          Try again
        </Button>
      </div>
    </div>
  </Alert>
);
