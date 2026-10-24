"use client";

import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";

import { useDeploymentLeaveGuard } from "@src/components/deployments/ConfigureDeployment/DeploymentFlowProvider/DeploymentFlowProvider";
import { DiscardDeploymentDialog } from "@src/components/deployments/ConfigureDeployment/DiscardDeploymentDialog/DiscardDeploymentDialog";
import { useServices } from "@src/context/ServicesProvider";
import type { SkipOnboardingSource } from "@src/hooks/useSkipOnboarding";
import { useSkipOnboarding } from "@src/hooks/useSkipOnboarding";

export const DEPENDENCIES = { useSkipOnboarding, useDeploymentLeaveGuard, useServices };

type Props = {
  source: SkipOnboardingSource;
  dependencies?: typeof DEPENDENCIES;
};

export function SkipOnboardingButton({ source, dependencies: d = DEPENDENCIES }: Props) {
  const { skip, isSkipping } = d.useSkipOnboarding();
  const { isCreating, holdsUnleasedDeployment, isLeaseInFlight, discard } = d.useDeploymentLeaveGuard();
  const { analyticsService } = d.useServices();
  const [isConfirming, setIsConfirming] = useState(false);

  if (isCreating) return null;

  function skipOrConfirm() {
    if (holdsUnleasedDeployment) setIsConfirming(true);
    else skipOnboarding(false);
  }

  /** The deployment may have been leased while the dialog was open, and a leased one is kept rather than closed. */
  function discardAndSkip() {
    setIsConfirming(false);
    if (holdsUnleasedDeployment) discard();
    skipOnboarding(holdsUnleasedDeployment);
  }

  function skipOnboarding(discardedDeployment: boolean) {
    analyticsService.track("onboarding_left", { category: "onboarding", control: "skip_button", discardedDeployment, midLease: isLeaseInFlight });
    void skip(source);
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" disabled={isSkipping} onClick={skipOrConfirm}>
        Skip onboarding - Explore Console
      </Button>
      <DiscardDeploymentDialog
        open={isConfirming}
        onOpenChange={setIsConfirming}
        title="Skip onboarding and discard this deployment?"
        description="Skipping closes the deployment you just started, along with any bids providers have sent for it."
        keepLabel="Keep deploying"
        discardLabel="Skip anyway"
        onDiscard={discardAndSkip}
      >
        <p className="text-sm text-muted-foreground">You can deploy again from Console at any time.</p>
      </DiscardDeploymentDialog>
    </>
  );
}
