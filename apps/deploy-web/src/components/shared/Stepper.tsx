"use client";
import React from "react";
import { cn } from "@akashnetwork/ui/utils";
import { Check } from "iconoir-react";

export interface Step {
  id: string | number;
  name: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  activeStep: number;
  onStepClick?: (step: Step, index: number) => void;
  className?: string;
  showArrows?: boolean;
  clickable?: boolean;
}

export const Stepper: React.FunctionComponent<StepperProps> = ({ steps, activeStep, onStepClick, className = "", showArrows = true, clickable = false }) => {
  const handleStepClick = (step: Step, index: number, ev: React.MouseEvent) => {
    if (!clickable || !onStepClick) return;

    ev.preventDefault();
    onStepClick(step, index);
  };

  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol role="list" className="divide-y divide-muted-foreground/20 border border-muted-foreground/20 md:flex md:divide-y-0">
        {steps.map((step, stepIdx) => (
          <li key={step.id} className="relative md:flex md:flex-1">
            {stepIdx < activeStep ? (
              <div
                className={cn("group flex w-full items-center", {
                  "cursor-pointer": clickable && onStepClick
                })}
                onClick={ev => handleStepClick(step, stepIdx, ev)}
              >
                <span className="flex items-center px-6 py-4 text-sm font-medium">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary group-hover:bg-primary/80">
                    <Check className="h-6 w-6 text-white" aria-hidden="true" />
                  </span>
                  <span className="ml-4 text-sm font-medium text-neutral-900 dark:text-neutral-500">{step.name}</span>
                </span>
              </div>
            ) : stepIdx === activeStep ? (
              <div className="flex items-center px-6 py-4 text-sm font-medium" aria-current="step">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary">
                  <span className="font-bold text-primary">{stepIdx + 1}</span>
                </span>
                <span className="ml-4 text-sm font-bold text-primary">{step.name}</span>
              </div>
            ) : (
              <div className="group flex items-center">
                <span className="flex items-center px-6 py-4 text-sm font-medium">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/20 group-hover:border-muted-foreground/30 dark:group-hover:border-muted-foreground/20">
                    <span className="text-muted-foreground group-hover:text-neutral-600 dark:group-hover:text-muted-foreground/70">{stepIdx + 1}</span>
                  </span>
                  <span className="ml-4 text-sm font-medium text-muted-foreground group-hover:text-neutral-600 dark:group-hover:text-muted-foreground/70">
                    {step.name}
                  </span>
                </span>
              </div>
            )}

            {showArrows && stepIdx !== steps.length - 1 ? (
              <>
                {/* Arrow separator for lg screens and up */}
                <div className="absolute right-0 top-0 hidden h-full w-5 md:block" aria-hidden="true">
                  <svg className="h-full w-full text-neutral-300 dark:text-neutral-700" viewBox="0 0 22 80" fill="none" preserveAspectRatio="none">
                    <path d="M0 -2L20 40L0 82" vectorEffect="non-scaling-stroke" stroke="currentcolor" strokeLinejoin="round" />
                  </svg>
                </div>
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
};
