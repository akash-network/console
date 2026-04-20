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

export const Stepper: React.FunctionComponent<StepperProps> = ({ steps, activeStep, onStepClick, className = "", clickable = false }) => {
  const handleStepClick = (step: Step, index: number, ev: React.MouseEvent) => {
    if (!clickable || !onStepClick) return;
    ev.preventDefault();
    onStepClick(step, index);
  };

  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol role="list" className="flex h-14 items-center border-b border-border bg-popover px-6">
        {steps.map((step, stepIdx) => {
          const isDone = stepIdx < activeStep;
          const isActive = stepIdx === activeStep;
          const isFuture = stepIdx > activeStep;

          return (
            <React.Fragment key={step.id}>
              <li className="flex items-center">
                <div
                  className={cn("flex items-center gap-2", {
                    "cursor-pointer": clickable && onStepClick && isDone
                  })}
                  onClick={ev => isDone && handleStepClick(step, stepIdx, ev)}
                >
                  {isDone ? (
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" aria-hidden="true" />
                    </span>
                  ) : isActive ? (
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                      <span className="text-xs font-semibold text-primary-foreground">{stepIdx + 1}</span>
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-muted-foreground/30">
                      <span className="text-xs text-muted-foreground">{stepIdx + 1}</span>
                    </span>
                  )}

                  <span
                    className={cn("whitespace-nowrap text-sm", {
                      "text-muted-foreground": isDone,
                      "font-medium text-foreground": isActive,
                      "text-muted-foreground/60": isFuture
                    })}
                  >
                    {step.name}
                  </span>
                </div>
              </li>

              {stepIdx !== steps.length - 1 && <li className="mx-4 h-px flex-1 bg-border" aria-hidden="true" />}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};
