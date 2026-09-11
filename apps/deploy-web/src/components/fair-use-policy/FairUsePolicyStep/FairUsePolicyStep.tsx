"use client";
import { Card, CardContent, LoadingButton } from "@akashnetwork/ui/components";

import {
  FAIR_USE_POLICY_ACCEPT_LABEL,
  FAIR_USE_POLICY_TITLE,
  FairUsePolicyContent
} from "@src/components/fair-use-policy/FairUsePolicyContent/FairUsePolicyContent";
import { OnboardingHeader } from "@src/components/layout/OnboardingHeader/OnboardingHeader";

export const DEPENDENCIES = { OnboardingHeader };

type Props = {
  onAccept: () => void;
  isAccepting: boolean;
  dependencies?: typeof DEPENDENCIES;
};

const TITLE_ID = "fair-use-policy-title";

/** The onboarding-flow presentation of the policy prompt: a page of its own rather than a modal over an empty page. */
export function FairUsePolicyStep({ onAccept, isAccepting, dependencies: d = DEPENDENCIES }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <d.OnboardingHeader />

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <section aria-labelledby={TITLE_ID} className="w-full max-w-xl">
          <Card>
            <CardContent className="space-y-4 p-6">
              <h1 id={TITLE_ID} className="text-lg font-semibold leading-snug tracking-tight">
                {FAIR_USE_POLICY_TITLE}
              </h1>

              <FairUsePolicyContent />

              <LoadingButton className="w-full" loading={isAccepting} onClick={onAccept} data-testid="fair-use-policy-accept-button">
                {FAIR_USE_POLICY_ACCEPT_LABEL}
              </LoadingButton>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
