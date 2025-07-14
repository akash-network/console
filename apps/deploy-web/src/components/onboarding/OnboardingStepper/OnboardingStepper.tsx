"use client";
import React from "react";
import { Button } from "@akashnetwork/ui/components";
import { ArrowLeft, ArrowRight } from "iconoir-react";

import { type Step, Stepper } from "@src/components/shared/Stepper";

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  component: React.ReactNode | null;
  isCompleted?: boolean;
  isDisabled?: boolean;
}

interface OnboardingStepperProps {
  steps: OnboardingStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onComplete?: () => void;
  showNavigation?: boolean;
  className?: string;
}

export const OnboardingStepper: React.FunctionComponent<OnboardingStepperProps> = ({
  steps,
  currentStep,
  onStepChange,
  onNext,
  onPrevious,
  onComplete,
  showNavigation = true,
  className = ""
}) => {
  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const canGoNext = currentStepData && !currentStepData.isDisabled;

  const handleNext = () => {
    if (isLastStep) {
      onComplete?.();
    } else {
      onNext?.();
      onStepChange(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      onPrevious?.();
      onStepChange(currentStep - 1);
    }
  };

  const handleStepClick = (_step: Step, _index: number) => {
    // Only allow clicking on completed steps or the current step
    if (_index <= currentStep) {
      onStepChange(_index);
    }
  };

  // Convert OnboardingStep to Step for the reusable Stepper
  const stepperSteps: Step[] = steps.map((step, _index) => ({
    id: step.id,
    name: step.title,
    description: step.description
  }));

  return (
    <div className={`mx-auto max-w-4xl ${className}`}>
      {/* Progress Bar */}
      <div className="mb-8">
        <Stepper steps={stepperSteps} activeStep={currentStep} onStepClick={handleStepClick} clickable={true} showArrows={false} />
      </div>

      {/* Current Step Content */}
      {currentStepData?.component && <div className="mb-8">{currentStepData.component}</div>}

      {/* Navigation */}
      {showNavigation && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handlePrevious} disabled={isFirstStep} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </div>

          <Button onClick={handleNext} disabled={!canGoNext} className="flex items-center gap-2">
            {isLastStep ? "Complete" : "Next"}
            {!isLastStep && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
};
