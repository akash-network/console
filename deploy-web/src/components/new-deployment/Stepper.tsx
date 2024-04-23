"use client";
import { useRouter } from "next/navigation";
import { UrlService } from "@src/utils/urlUtils";
import { RouteStepKeys } from "@src/utils/constants";
import { Check } from "iconoir-react";
import React from "react";

interface Step {
  id: number;
  name: string;
}
const steps: Step[] = [
  { id: 0, name: "Choose Template" },
  { id: 1, name: "Create Deployment" },
  { id: 2, name: "Choose providers" }
];

export const CustomizedSteppers = ({ activeStep }: React.PropsWithChildren<{ activeStep: number }>) => {
  const router = useRouter();

  function onChooseTemplateClick(ev: React.MouseEvent<HTMLAnchorElement>, step: Step) {
    ev.preventDefault();

    if (step.id === 0) {
      router.replace(UrlService.newDeployment({ step: RouteStepKeys.chooseTemplate }));
    }
  }

  return (
    <nav aria-label="Progress" className="w-full">
      <ol role="list" className="divide-y divide-muted-foreground/20 border border-muted-foreground/20 md:flex md:divide-y-0">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className="relative md:flex md:flex-1">
            {step.id < activeStep ? (
              <a href="#" className="group flex w-full items-center" onClick={ev => onChooseTemplateClick(ev, step)}>
                <span className="flex items-center px-6 py-4 text-sm font-medium">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary group-hover:bg-primary/80">
                    <Check className="h-6 w-6 text-white" aria-hidden="true" />
                  </span>
                  <span className="ml-4 text-sm font-medium text-gray-900">{step.name}</span>
                </span>
              </a>
            ) : step.id === activeStep ? (
              <div className="flex items-center px-6 py-4 text-sm font-medium" aria-current="step">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary">
                  <span className="font-bold text-primary">{step.id + 1}</span>
                </span>
                <span className="ml-4 text-sm font-bold text-primary">{step.name}</span>
              </div>
            ) : (
              <div className="group flex items-center">
                <span className="flex items-center px-6 py-4 text-sm font-medium">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/20 group-hover:border-muted-foreground/30">
                    <span className="text-gray-500 group-hover:text-gray-900">{step.id + 1}</span>
                  </span>
                  <span className="ml-4 text-sm font-medium text-gray-500 group-hover:text-gray-900">{step.name}</span>
                </span>
              </div>
            )}

            {stepIdx !== steps.length - 1 ? (
              <>
                {/* Arrow separator for lg screens and up */}
                <div className="absolute right-0 top-0 hidden h-full w-5 md:block" aria-hidden="true">
                  <svg className="h-full w-full text-gray-300" viewBox="0 0 22 80" fill="none" preserveAspectRatio="none">
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
