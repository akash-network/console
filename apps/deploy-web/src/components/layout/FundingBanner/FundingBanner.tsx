"use client";
import { useState } from "react";
import { Banner } from "@akashnetwork/ui/components";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { useWallet } from "@src/context/WalletProvider";

/** Copy for the Add Credits sheet when opened from the always-on funding banner — no specific template context. */
const FUNDING_SHEET_DESCRIPTION = "You're on the free plan — CPU deployments only. Unlock GPUs, unlimited runtime, and the full Console.";

export const DEPENDENCIES = { AddCreditsSheet, useWallet };

interface FundingBannerProps {
  dependencies?: typeof DEPENDENCIES;
}

export function FundingBanner({ dependencies: d = DEPENDENCIES }: FundingBannerProps) {
  const { hasManagedWallet } = d.useWallet();
  const [isAddCreditsOpen, setIsAddCreditsOpen] = useState(false);

  return (
    <>
      <Banner variant="info" onClick={openAddCredits}>
        <span>
          <span className="font-semibold">Get $100</span> · Purchase your first credits and get up to $100 free. Access the full GPU marketplace and unlimited
          deployments.
        </span>
      </Banner>

      <d.AddCreditsSheet
        open={isAddCreditsOpen}
        onOpenChange={setIsAddCreditsOpen}
        initialTab="purchase"
        description={FUNDING_SHEET_DESCRIPTION}
        isWalletReady={hasManagedWallet}
        onDone={closeAddCredits}
      />
    </>
  );

  function openAddCredits() {
    setIsAddCreditsOpen(true);
  }

  function closeAddCredits() {
    setIsAddCreditsOpen(false);
  }
}
