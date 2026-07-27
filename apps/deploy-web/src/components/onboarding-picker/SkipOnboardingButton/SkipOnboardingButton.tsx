"use client";

import { Button } from "@akashnetwork/ui/components";

import type { SkipOnboardingSource } from "@src/hooks/useSkipOnboarding";
import { useSkipOnboarding } from "@src/hooks/useSkipOnboarding";

export const DEPENDENCIES = { useSkipOnboarding };

type Props = {
  source: SkipOnboardingSource;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
};

export function SkipOnboardingButton({ source, className, dependencies: d = DEPENDENCIES }: Props) {
  const { skip, isSkipping } = d.useSkipOnboarding();

  return (
    <Button variant="ghost" size="sm" className={className} disabled={isSkipping} onClick={() => skip(source)}>
      Skip
    </Button>
  );
}
