"use client";
import { Banner } from "@akashnetwork/ui/components";

import { useBillingSheet } from "@src/context/BillingSheetProvider";

/** Copy for the Add Credits sheet when opened from the always-on funding banner — no specific template context. */
const FUNDING_SHEET_DESCRIPTION = "You're on the free plan — CPU deployments only. Unlock GPUs, unlimited runtime, and the full Console.";

export const DEPENDENCIES = { useBillingSheet };

interface FundingBannerProps {
  dependencies?: typeof DEPENDENCIES;
}

export function FundingBanner({ dependencies: d = DEPENDENCIES }: FundingBannerProps) {
  const { open: openBillingSheet } = d.useBillingSheet();

  return (
    <Banner variant="info" onClick={openAddCredits}>
      <span>
        <span className="font-semibold">Get $100</span> · Purchase your first credits and get up to $100 free. Access the full GPU marketplace and unlimited
        deployments.
      </span>
    </Banner>
  );

  function openAddCredits() {
    openBillingSheet({ initialTab: "purchase", description: FUNDING_SHEET_DESCRIPTION });
  }
}
