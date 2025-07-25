"use client";
import React from "react";
import { useRouter } from "next/navigation";

import { type Step, Stepper } from "@src/components/shared/Stepper";
import { RouteStep } from "@src/types/route-steps.type";
import { UrlService } from "@src/utils/urlUtils";

const steps: Step[] = [
  { id: 0, name: "Choose Template" },
  { id: 1, name: "Create Deployment" },
  { id: 2, name: "Choose providers" }
];

export const CustomizedSteppers = ({ activeStep }: React.PropsWithChildren<{ activeStep: number }>) => {
  const router = useRouter();

  const handleStepClick = (step: Step, _index: number) => {
    if (step.id === 0) {
      router.replace(UrlService.newDeployment({ step: RouteStep.chooseTemplate }));
    }
  };

  return <Stepper steps={steps} activeStep={activeStep} onStepClick={handleStepClick} clickable={true} />;
};
