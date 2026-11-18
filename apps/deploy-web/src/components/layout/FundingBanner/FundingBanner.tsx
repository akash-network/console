"use client";
import { Banner } from "@akashnetwork/ui/components";

import { useAddCredits } from "@src/hooks/useAddCredits";
import { useIsOutOfDeployCredit } from "@src/hooks/useIsOutOfDeployCredit/useIsOutOfDeployCredit";

const FREE_PLAN_SHEET_DESCRIPTION = "You're on the free plan, with CPU deployments only. Unlock GPUs, unlimited runtime, and the full Console.";
const TRIAL_CREDIT_USED_UP_SHEET_DESCRIPTION = "Your free trial credit is used up. Add credits to keep deploying, with GPUs and unlimited runtime unlocked.";

export const DEPENDENCIES = { useAddCredits, useIsOutOfDeployCredit };

interface FundingBannerProps {
  dependencies?: typeof DEPENDENCIES;
}

export function FundingBanner({ dependencies: d = DEPENDENCIES }: FundingBannerProps) {
  const openAddCredits = d.useAddCredits();
  const isTrialCreditUsedUp = d.useIsOutOfDeployCredit();

  if (isTrialCreditUsedUp) {
    return (
      <Banner
        variant="warning"
        onClick={() =>
          openAddCredits({ initialTab: "purchase", description: TRIAL_CREDIT_USED_UP_SHEET_DESCRIPTION, context: "funding_banner_trial_credit_used_up" })
        }
      >
        <span>
          <span className="font-semibold">Your free trial credit is used up</span> · Add credits to keep deploying. Your first purchase gets up to $100 free.
        </span>
      </Banner>
    );
  }

  return (
    <Banner variant="info" onClick={() => openAddCredits({ initialTab: "purchase", description: FREE_PLAN_SHEET_DESCRIPTION, context: "funding_banner" })}>
      <span>
        <span className="font-semibold">Get $100</span> · Purchase your first credits and get up to $100 free. Access the full GPU marketplace and unlimited
        deployments.
      </span>
    </Banner>
  );
}
