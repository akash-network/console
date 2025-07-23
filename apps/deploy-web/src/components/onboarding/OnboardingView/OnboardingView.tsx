import type { FC } from "react";
import React from "react";

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

  return <d.OnboardingStepper steps={stepsWithComponents} currentStep={currentStep} />;
};
