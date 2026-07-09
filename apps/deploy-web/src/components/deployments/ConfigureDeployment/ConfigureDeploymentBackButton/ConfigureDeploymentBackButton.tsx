"use client";
import type { FC } from "react";
import { useCallback } from "react";
import { Button } from "@akashnetwork/ui/components";
import { NavArrowLeft } from "iconoir-react";
import { useRouter } from "next/navigation";

import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  useRouter,
  usePreviousRoute,
  UrlService
};

type Props = { dependencies?: typeof DEPENDENCIES };

/**
 * Back control for the configure screen. During onboarding the app chrome (sidebar/nav) is stripped, so this is the
 * only way out. Returns to wherever the user came from when there's history, otherwise the onboarding picker.
 */
export const ConfigureDeploymentBackButton: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const previousRoute = d.usePreviousRoute();

  const goBack = useCallback(() => {
    if (previousRoute) {
      router.back();
    } else {
      router.push(d.UrlService.onboardingPicker());
    }
  }, [previousRoute, router, d]);

  return (
    <Button type="button" variant="ghost" onClick={goBack} className="-ml-2 h-8 gap-1 px-2 text-muted-foreground">
      <NavArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
};
