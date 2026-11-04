"use client";
import { Card, CardContent, LoadingButton } from "@akashnetwork/ui/components";
import { ShieldCheck } from "lucide-react";

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
    <div className="flex min-h-dvh flex-col bg-background">
      <d.OnboardingHeader />

      <div className="flex flex-1 items-center justify-center px-5 py-12 bg-dots">
        <section aria-labelledby={TITLE_ID} className="w-full max-w-[600px]">
          <Card className="rounded-2xl shadow-[0_28px_64px_-40px_rgba(0,0,0,0.5)]">
            <CardContent className="px-5 py-6 sm:p-8">
              <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-[10px] border bg-muted">
                <ShieldCheck className="h-[18px] w-[18px]" />
              </span>

              <h1 id={TITLE_ID} className="text-balance text-[22px] font-semibold leading-[29px] tracking-tight">
                {FAIR_USE_POLICY_TITLE}
              </h1>

              <div className="mt-2.5">
                <FairUsePolicyContent />
              </div>

              <LoadingButton
                size="lg"
                className="mt-6 w-full rounded-[10px]"
                loading={isAccepting}
                onClick={onAccept}
                data-testid="fair-use-policy-accept-button"
              >
                {FAIR_USE_POLICY_ACCEPT_LABEL}
              </LoadingButton>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
