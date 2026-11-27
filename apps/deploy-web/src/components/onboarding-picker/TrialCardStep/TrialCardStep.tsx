"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, CardContent, LoadingButton, Snackbar } from "@akashnetwork/ui/components";
import { CreditCard } from "lucide-react";
import { useSnackbar } from "notistack";

import { OnboardingHeader } from "@src/components/layout/OnboardingHeader/OnboardingHeader";
import { NewCardFields, type NewCardHandle } from "@src/components/organizations/NewCardFields/NewCardFields";
import { useServices } from "@src/context/ServicesProvider";
import { useStartTrialWithCard } from "@src/hooks/useStartTrialWithCard/useStartTrialWithCard";

export const DEPENDENCIES = { OnboardingHeader, NewCardFields, useStartTrialWithCard, useServices, useSnackbar };

type Props = {
  onAddCredits: () => void;
  onSkip: () => void;
  dependencies?: typeof DEPENDENCIES;
};

const TITLE_ID = "trial-card-title";

/** The onboarding step of an account whose free trial waits for a card: a page of its own, with adding credits and leaving it for later as the ways around. */
export function TrialCardStep({ onAddCredits, onSkip, dependencies: d = DEPENDENCIES }: Props) {
  const cardRef = useRef<NewCardHandle>(null);
  const [isCardComplete, setIsCardComplete] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const { startTrial, isStarting } = d.useStartTrialWithCard();
  const { analyticsService } = d.useServices();
  const { enqueueSnackbar } = d.useSnackbar();

  useEffect(
    function trackStepShown() {
      analyticsService.track("trial_card_step_shown", { category: "onboarding" });
    },
    [analyticsService]
  );

  const startTrialWithCard = async () => {
    if (!cardRef.current) return;

    setFailure(null);
    const result = await startTrial(cardRef.current);

    if (result.status === "failed") setFailure(result.message);
    if (result.status === "started") {
      enqueueSnackbar(<Snackbar title="Card verified" subTitle="Your free trial is starting." iconVariant="success" />, { variant: "success" });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <d.OnboardingHeader />

      <div className="flex flex-1 items-center justify-center px-5 py-12 bg-dots">
        <section aria-labelledby={TITLE_ID} className="w-full max-w-[600px]">
          <Card className="rounded-2xl shadow-[0_28px_64px_-40px_rgba(0,0,0,0.5)]">
            <CardContent className="px-5 py-6 sm:p-8">
              <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-[10px] border bg-muted">
                <CreditCard className="h-[18px] w-[18px]" />
              </span>

              <h1 id={TITLE_ID} className="text-balance text-[22px] font-semibold leading-[29px] tracking-tight">
                Add a card to start your free trial
              </h1>

              <p className="mt-2.5 text-sm text-muted-foreground">
                Your sign-up looks like others we have recently seen from the same network or email pattern, so we ask for a card before the trial starts. It
                tells us a real person is behind the account.
              </p>

              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Your card is not charged. Your bank may ask you to confirm it is you.</li>
                <li>Each card can start one free trial, and prepaid cards can&apos;t start one.</li>
                <li>The card is saved to your account for adding credits later. You can remove it in Billing.</li>
              </ul>

              <div className="mt-6">
                <d.NewCardFields ref={cardRef} onCompleteChange={setIsCardComplete} />
              </div>

              {failure && (
                <Alert className="mt-4" variant="destructive" role="alert">
                  {failure}
                </Alert>
              )}

              <LoadingButton size="lg" className="mt-6 w-full rounded-[10px]" loading={isStarting} disabled={!isCardComplete} onClick={startTrialWithCard}>
                Start free trial
              </LoadingButton>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" size="sm" disabled={isStarting} onClick={onAddCredits}>
                  Add credits instead
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={isStarting} onClick={onSkip}>
                  Not now
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
