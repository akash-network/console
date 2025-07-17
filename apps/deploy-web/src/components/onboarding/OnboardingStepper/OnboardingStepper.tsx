"use client";
import React from "react";

import { type Step, Stepper } from "@src/components/shared/Stepper";

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  component: React.ReactNode | null;
  isCompleted?: boolean;
  isDisabled?: boolean;
  hidePreviousButton?: boolean;
}

interface OnboardingStepperProps {
  steps: OnboardingStep[];
  currentStep: number;
  className?: string;
}

export const OnboardingStepper: React.FunctionComponent<OnboardingStepperProps> = ({ steps, currentStep, className = "" }) => {
  const currentStepData = steps[currentStep];

  const stepperSteps: Step[] = steps.map((step, _index) => ({
    id: step.id,
    name: step.title,
    description: step.description
  }));

  return (
    <div className={`mx-auto max-w-4xl ${className}`}>
      <div className="mb-8">
        <Stepper steps={stepperSteps} activeStep={currentStep} clickable={true} showArrows={false} />
      </div>

      {currentStepData?.component && <div className="mb-8">{currentStepData.component}</div>}
    </div>
  );
};
