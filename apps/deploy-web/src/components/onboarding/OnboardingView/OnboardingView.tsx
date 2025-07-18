import type { FC } from "react";
import React from "react";

import { OnboardingStepIndex } from "../OnboardingContainer/OnboardingContainer";
import { type OnboardingStep, OnboardingStepper } from "../OnboardingStepper/OnboardingStepper";
import { EmailVerificationContainer } from "../steps/EmailVerificationContainer/EmailVerificationContainer";
import { EmailVerificationStep } from "../steps/EmailVerificationStep/EmailVerificationStep";
import { FreeTrialLandingStep } from "../steps/FreeTrialLandingStep/FreeTrialLandingStep";
import { PaymentMethodStep } from "../steps/PaymentMethodStep/PaymentMethodStep";
import { WelcomeStep } from "../steps/WelcomeStep/WelcomeStep";

const DEPENDENCIES = {
  OnboardingStepper,
  FreeTrialLandingStep,
  EmailVerificationContainer,
  EmailVerificationStep,
  PaymentMethodStep,
  WelcomeStep
};

export interface OnboardingViewProps {
  currentStep: number;
  steps: OnboardingStep[];
  onStepChange: (step: number) => void;
  onStartTrial: () => void;
  onPaymentMethodComplete: () => void;
  onComplete: () => void;
  isLoading: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const OnboardingView: FC<OnboardingViewProps> = ({
  currentStep,
  steps,
  onStepChange,
  onStartTrial,
  onPaymentMethodComplete,
  onComplete,
  isLoading,
  dependencies: d = DEPENDENCIES
}) => {
  // Create steps with components
  const stepsWithComponents: OnboardingStep[] = [
    {
      ...steps[0],
      component: <d.FreeTrialLandingStep onStartTrial={onStartTrial} />
    },
    {
      ...steps[1],
      component: null // No component needed for redirect step
    },
    {
      ...steps[2],
      component: (
        <d.EmailVerificationContainer onComplete={() => onStepChange(OnboardingStepIndex.PAYMENT_METHOD)}>
          {props => <d.EmailVerificationStep {...props} />}
        </d.EmailVerificationContainer>
      )
    },
    {
      ...steps[3],
      component: <d.PaymentMethodStep onComplete={onPaymentMethodComplete} />
    },
    {
      ...steps[4],
      component: <d.WelcomeStep onComplete={onComplete} />
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <d.OnboardingStepper steps={stepsWithComponents} currentStep={currentStep} />;
};
