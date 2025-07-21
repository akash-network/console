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
  dependencies?: typeof DEPENDENCIES;
}

export const OnboardingView: FC<OnboardingViewProps> = ({
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

  return <d.OnboardingStepper steps={stepsWithComponents} currentStep={currentStep} />;
};
