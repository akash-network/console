"use client";
import React from "react";
import { Check, InfoCircleSolid } from "iconoir-react";

// Define the structure for a step in the stepper
interface Step {
  id: number;
  name: string;
}

// Define the steps for the provider onboarding process
const steps: Step[] = [
  { id: 0, name: "1. Server Access" },
  { id: 1, name: "2. Provider Config" },
  { id: 2, name: "3. Provider Attributes" },
  { id: 3, name: "4. Provider Pricing" },
  { id: 4, name: "5. Import Wallet" }
];

const StepContent: React.FC<{ step: Step; activeStep: number }> = ({ step, activeStep }) => {
  if (step.id < activeStep) {
    return <CompletedStep step={step} />;
  } else if (step.id === activeStep) {
    return <CurrentStep step={step} />;
  } else {
    return <FutureStep step={step} />;
  }
};

export const CustomizedSteppers: React.FC<{ activeStep: number }> = ({ activeStep }) => {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol role="list" className="divide-muted-foreground/20 border-muted-foreground/20 divide-y border md:flex md:divide-y-0">
        {steps.map(step => (
          <li key={step.name} className="relative md:flex md:flex-1">
            <StepContent step={step} activeStep={activeStep} />
          </li>
        ))}
      </ol>
    </nav>
  );
};

const CompletedStep: React.FC<{ step: Step }> = ({ step }) => (
  <div className="flex items-center px-6 py-4 text-sm font-medium">
    <span className="bg-primary group-hover:bg-primary/80 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full">
      <Check className="h-4 w-4 text-white" aria-hidden="true" />
    </span>
    <span className="ml-4 text-sm font-medium text-neutral-900 dark:text-neutral-500">{step.name}</span>
  </div>
);

// Component for the current active step
const CurrentStep: React.FC<{ step: Step }> = ({ step }) => (
  <div className="flex items-center px-6 py-4 text-sm font-medium" aria-current="step">
    <span className="border-primary flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2">
      <InfoCircleSolid className="h-5 w-5" aria-hidden="true" />
    </span>
    <span className="text-primary ml-4 text-sm font-bold">{step.name}</span>
  </div>
);

// Component for future (not yet reached) steps
const FutureStep: React.FC<{ step: Step }> = ({ step }) => (
  <div className="group flex items-center">
    <span className="flex items-center px-6 py-4 text-sm font-medium">
      <span className="border-muted-foreground/20 group-hover:border-muted-foreground/30 dark:group-hover:border-muted-foreground/20 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2"></span>
      <span className="text-muted-foreground dark:group-hover:text-muted-foreground/70 ml-4 text-sm font-medium group-hover:text-neutral-600">{step.name}</span>
    </span>
  </div>
);
