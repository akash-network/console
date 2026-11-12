import type { FC } from "react";
import { Alert, AlertDescription, AlertTitle, Button } from "@akashnetwork/ui/components";
import { TriangleAlertIcon } from "lucide-react";

import type { DepositShortfall } from "../depositShortfall/depositShortfall";
import { describeDepositShortfall, formatUsd } from "../depositShortfall/depositShortfall";
import type { NeedsFundsVariant } from "../needsFundsVariant/needsFundsVariant";

const NEEDS_FUNDS_FALLBACK_MESSAGE = "Your balance doesn't cover this deployment yet. Add credits, then try again.";

type Props = {
  variant: NeedsFundsVariant;
  message?: string;
  shortfall?: DepositShortfall;
  onAddCredits: () => void;
  /** Left out while the balance still can't cover the deploy, since a retry would only be refused again. */
  onTryAgain?: () => void;
};

export const NeedsFundsAlert: FC<Props> = ({ variant, message, shortfall, onAddCredits, onTryAgain }) => {
  const { title, description } = copyOf(variant, shortfall ? describeDepositShortfall(shortfall) : message ?? NEEDS_FUNDS_FALLBACK_MESSAGE);

  return (
    <Alert variant="warning" className="p-4">
      <TriangleAlertIcon className="h-4 w-4" aria-hidden="true" />
      <div className="flex flex-col gap-3 text-foreground">
        <div>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription className="text-muted-foreground">{description}</AlertDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" size="sm" onClick={onAddCredits}>
            Add credits
          </Button>
          {onTryAgain && (
            <Button type="button" size="sm" variant="outline" onClick={onTryAgain}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
};

function copyOf(variant: NeedsFundsVariant, balanceDescription: string) {
  switch (variant.name) {
    case "trial_credit_used_up":
      return {
        title: "Your free trial credit is used up",
        description: "Add credits to deploy. Your deployment carries on from here once they land."
      };
    case "trial_credit_below_minimum":
      return {
        title: "Your free trial credit is below the deployment minimum",
        description: `You have ${formatUsd(variant.availableAmountUsd)} of free trial credit left, and every deployment needs at least ${formatUsd(variant.minimumDepositUsd)} up front, so changing the configuration won't help. Add credits to deploy.`
      };
    case "not_enough_balance":
      return { title: "Add credits to deploy", description: balanceDescription };
  }
}
