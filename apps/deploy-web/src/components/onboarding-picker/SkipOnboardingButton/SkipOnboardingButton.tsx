"use client";

import { useState } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useDeploymentLeaveGuard } from "@src/components/deployments/ConfigureDeployment/DeploymentFlowProvider/DeploymentFlowProvider";
import { DiscardDeploymentDialog } from "@src/components/deployments/ConfigureDeployment/DiscardDeploymentDialog/DiscardDeploymentDialog";
import { useServices } from "@src/context/ServicesProvider";
import type { SkipOnboardingSource } from "@src/hooks/useSkipOnboarding";
import { useSkipOnboarding } from "@src/hooks/useSkipOnboarding";

export const DEPENDENCIES = { useSkipOnboarding, useDeploymentLeaveGuard, useServices, useSnackbar, Snackbar };

type Props = {
  source: SkipOnboardingSource;
  dependencies?: typeof DEPENDENCIES;
};

export function SkipOnboardingButton({ source, dependencies: d = DEPENDENCIES }: Props) {
  const { skip, isSkipping } = d.useSkipOnboarding();
  const { isCreating, holdsUnleasedDeployment, isLeaseInFlight, keepsDeployingWithoutPage, discard } = d.useDeploymentLeaveGuard();
  const { analyticsService } = d.useServices();
  const { enqueueSnackbar } = d.useSnackbar();
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
    analyticsService.track("onboarding_left", {
      category: "onboarding",
      control: "skip_button",
      discardedDeployment,
      midLease: isLeaseInFlight,
      deploymentKeepsGoing: keepsDeployingWithoutPage
    });
    if (keepsDeployingWithoutPage) {
      enqueueSnackbar(
        <d.Snackbar title="Your deployment keeps going" subTitle="Skipping onboarding doesn't stop it. You'll find it in Deployments." iconVariant="info" />,
        { variant: "info" }
      );
    }
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
