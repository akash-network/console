"use client";
import React from "react";
import { Check, InfoCircleSolid } from "iconoir-react";
import { useRouter } from "next/navigation";

import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";

enum RouteStepKeys {
  chooseTemplate = "choose-template",
  editDeployment = "edit-deployment",
  createLeases = "create-leases"
}

interface Step {
  id: number;
  name: string;
}
const steps: Step[] = [
  { id: 0, name: "1. Server Access" },
  { id: 1, name: "2. Import Wallet" },
  { id: 2, name: "3. Provider Config" },
  { id: 3, name: "4. Provider Pricing" },
  { id: 4, name: "5. Setting up Provider" }
];

export const CustomizedSteppers = ({ activeStep }: React.PropsWithChildren<{ activeStep: number }>) => {
  const router = useRouter();

  function onChooseTemplateClick(ev: React.MouseEvent<HTMLAnchorElement>, step: Step) {
    ev.preventDefault();

    // if (step.id === 0) {
    //   router.replace(UrlService.newDeployment({ step: RouteStepKeys.chooseTemplate }));
    // }
  }

  return (
    <nav aria-label="Progress" className="w-full">
      <ol role="list" className="divide-muted-foreground/20 border-muted-foreground/20 divide-y border md:flex md:divide-y-0">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className="relative md:flex md:flex-1">
            {step.id < activeStep ? (
              <a
                href="#"
                className={cn("group flex w-full items-center", { "pointer-events-auto": step.id !== 0 })}
                onClick={ev => onChooseTemplateClick(ev, step)}
              >
                <span className="flex items-center px-6 py-4 text-sm font-medium">
                  <span className="bg-primary group-hover:bg-primary/80 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                    <Check className="h-5 w-5 text-white" aria-hidden="true" />
                  </span>
                  <span className="ml-4 text-sm font-medium text-neutral-900 dark:text-neutral-500">{step.name}</span>
                </span>
              </a>
            ) : step.id === activeStep ? (
              <div className="flex items-center px-6 py-4 text-sm font-medium" aria-current="step">
                <span className="border-primary flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2">
                  {/* <span className="text-primary font-bold">{step.id + 1}</span> */}
                  <InfoCircleSolid className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-primary ml-4 text-sm font-bold">{step.name}</span>
              </div>
            ) : (
              <div className="group flex items-center">
                <span className="flex items-center px-6 py-4 text-sm font-medium">
                  <span className="border-muted-foreground/20 group-hover:border-muted-foreground/30 dark:group-hover:border-muted-foreground/20 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2">
                    {/* <span className="text-muted-foreground dark:group-hover:text-muted-foreground/70 group-hover:text-neutral-600">{step.id + 1}</span> */}
                  </span>
                  <span className="text-muted-foreground dark:group-hover:text-muted-foreground/70 ml-4 text-sm font-medium group-hover:text-neutral-600">
                    {step.name}
                  </span>
                </span>
              </div>
            )}

            {stepIdx !== steps.length - 1 ? (
              <>
                {/* Arrow separator for lg screens and up */}
                <div className="absolute right-0 top-0 hidden h-full w-1 border-r md:block" aria-hidden="true">
                  {/* <svg className="h-full w-full text-neutral-300 dark:text-neutral-700" viewBox="0 0 22 80" fill="none" preserveAspectRatio="none">
                    <path d="M0 -2L20 40L0 82" vectorEffect="non-scaling-stroke" stroke="currentcolor" strokeLinejoin="round" />
                  </svg> */}
                </div>
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
};
