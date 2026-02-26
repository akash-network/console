import type { FC } from "react";
import React from "react";
import { buttonVariants, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { LogOut } from "iconoir-react";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import { OnboardingStepIndex } from "../OnboardingContainer/OnboardingContainer";
import { type OnboardingStep, OnboardingStepper } from "../OnboardingStepper/OnboardingStepper";
import { EmailVerificationContainer } from "../steps/EmailVerificationContainer/EmailVerificationContainer";
import { EmailVerificationStep } from "../steps/EmailVerificationStep/EmailVerificationStep";
import { FreeTrialLandingStep } from "../steps/FreeTrialLandingStep/FreeTrialLandingStep";
import { PaymentMethodContainer } from "../steps/PaymentMethodContainer/PaymentMethodContainer";
import { PaymentMethodStep } from "../steps/PaymentMethodStep/PaymentMethodStep";
import { WelcomeStep } from "../steps/WelcomeStep/WelcomeStep";

const DEPENDENCIES = {
  OnboardingStepper,
  FreeTrialLandingStep,
  EmailVerificationContainer,
  EmailVerificationStep,
  PaymentMethodContainer,
  PaymentMethodStep,
  WelcomeStep
};

export interface OnboardingViewProps {
  isLoading: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  onStepChange: (step: number) => void;
  onStartTrial: () => void;
  onPaymentMethodComplete: () => void;
  onComplete: (templateName?: string) => Promise<void>;
  dependencies?: typeof DEPENDENCIES;
}

export const OnboardingView: FC<OnboardingViewProps> = ({
  isLoading,
  currentStep,
  steps,
  onStepChange,
  onStartTrial,
  onPaymentMethodComplete,
  onComplete,
  dependencies: d = DEPENDENCIES
}) => {
  const stepsWithComponents: OnboardingStep[] = [
    {
      ...steps[OnboardingStepIndex.FREE_TRIAL],
      component: <d.FreeTrialLandingStep onStartTrial={onStartTrial} />
    },
    {
      ...steps[OnboardingStepIndex.SIGNUP],
      component: null // No component needed for redirect step
    },
    {
      ...steps[OnboardingStepIndex.EMAIL_VERIFICATION],
      component: (
        <d.EmailVerificationContainer onComplete={() => onStepChange(OnboardingStepIndex.PAYMENT_METHOD)}>
          {props => <d.EmailVerificationStep {...props} />}
        </d.EmailVerificationContainer>
      )
    },
    {
      ...steps[OnboardingStepIndex.PAYMENT_METHOD],
      component: <d.PaymentMethodContainer onComplete={onPaymentMethodComplete}>{props => <d.PaymentMethodStep {...props} />}</d.PaymentMethodContainer>
    },
    {
      ...steps[OnboardingStepIndex.WELCOME],
      component: <d.WelcomeStep onComplete={onComplete} />
    }
  ];

  const { analyticsService, authService } = useServices();
  const { user } = useUser();

  const handleLogout = () => {
    analyticsService.track("onboarding_logout", {
      category: "onboarding"
    });
    authService.logout();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <Spinner size="large" />
        <p className="text-sm text-muted-foreground">Preparing your onboarding...</p>
      </div>
    );
  }

  return (
    <>
      <d.OnboardingStepper steps={stepsWithComponents} currentStep={currentStep} />
      {user && currentStep !== OnboardingStepIndex.WELCOME && (
        <div className="pb-4 text-center transition-opacity duration-500">
          <button
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex items-center gap-1.5 text-xs text-muted-foreground")}
            onClick={handleLogout}
          >
            <LogOut className="h-3 w-3" />
            Logout
          </button>
        </div>
      )}
    </>
  );
};
