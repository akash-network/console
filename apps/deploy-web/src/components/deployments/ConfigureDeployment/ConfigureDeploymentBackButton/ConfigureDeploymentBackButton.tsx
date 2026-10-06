"use client";
import type { FC } from "react";
import { useCallback } from "react";
import { Button } from "@akashnetwork/ui/components";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { useHasInAppHistory } from "@src/hooks/useHasInAppHistory";
import { UrlService } from "@src/utils/urlUtils";
import { useIsDeploymentCreating } from "../DeploymentFlowProvider/DeploymentFlowProvider";

export const DEPENDENCIES = {
  useRouter,
  useHasInAppHistory,
  useIsDeploymentCreating,
  UrlService
};

type Props = { dependencies?: typeof DEPENDENCIES };

/**
 * Back control for the configure screen. During onboarding the app chrome (sidebar/nav) is stripped, so this is the
 * only way out. Returns to wherever the user came from when there's history, otherwise the onboarding picker.
 */
export const ConfigureDeploymentBackButton: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const hasInAppHistory = d.useHasInAppHistory();
  const isDeploymentCreating = d.useIsDeploymentCreating();

  const goBack = useCallback(() => {
    if (hasInAppHistory) {
      router.back();
    } else {
      router.push(d.UrlService.onboardingPicker());
    }
  }, [hasInAppHistory, router, d]);

  return (
    <Button type="button" variant="ghost" onClick={goBack} disabled={isDeploymentCreating} className="-ml-2 h-8 gap-1 px-2 text-muted-foreground">
      <ChevronLeft className="h-4 w-4" />
      Back
    </Button>
  );
};
