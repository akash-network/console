"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { usePaymentMethodsQuery } from "@src/queries/usePaymentQueries";
import { UrlService } from "@src/utils/urlUtils";
import { type OnboardingStep, OnboardingStepper } from "../OnboardingStepper/OnboardingStepper";
import { EmailVerificationStep } from "../steps/EmailVerificationStep/EmailVerificationStep";
import { FreeTrialLandingStep } from "../steps/FreeTrialLandingStep/FreeTrialLandingStep";
import { PaymentMethodStep } from "../steps/PaymentMethodStep/PaymentMethodStep";
import { WelcomeStep } from "../steps/WelcomeStep/WelcomeStep";

export const OnboardingContainer: React.FunctionComponent = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const router = useRouter();
  const { data: paymentMethods = [] } = usePaymentMethodsQuery();

  useEffect(() => {
    const savedStep = localStorage.getItem("onboardingStep");
    if (savedStep) {
      const step = parseInt(savedStep, 10);
      if (step >= 0 && step < 5) {
        setCurrentStep(step);
      }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const fromSignup = urlParams.get("fromSignup");
    if (fromSignup === "true") {
      setCompletedSteps(prev => new Set([...prev, 1]));
      setCurrentStep(2);
      localStorage.setItem("onboardingStep", "2");

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("fromSignup");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, []);

  const handleStepChange = (step: number) => {
    if (step === 4 && currentStep === 3) {
      if (paymentMethods.length === 0) {
        return;
      }
    }

    setCurrentStep(step);
    localStorage.setItem("onboardingStep", step.toString());
  };

  const handleStepComplete = (step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const handleNext = () => {
    if (currentStep === 3) {
      if (paymentMethods.length === 0) {
        return;
      }
    }

    handleStepComplete(currentStep);
  };

  const handleComplete = () => {
    localStorage.removeItem("onboardingStep");
    router.push("/");
  };

  const handleStartTrial = () => {
    handleStepComplete(0);

    const returnUrl = `${window.location.origin}${UrlService.onboarding(true)}`;
    const signupUrl = `${UrlService.signup()}?returnTo=${encodeURIComponent(returnUrl)}`;
    window.location.href = signupUrl;
  };

  const handlePaymentMethodComplete = () => {
    if (paymentMethods.length > 0) {
      handleStepComplete(3);
      handleStepChange(4);
    }
  };

  const steps: OnboardingStep[] = [
    {
      id: "free-trial",
      title: "Free Trial",
      description: "Learn about benefits",
      component: <FreeTrialLandingStep onStartTrial={handleStartTrial} />,
      isCompleted: completedSteps.has(0)
    },
    {
      id: "signup",
      title: "Create Account",
      description: "Sign up with Auth0",
      component: null, // No component needed for redirect step
      isCompleted: completedSteps.has(1)
    },
    {
      id: "email-verification",
      title: "Verify Email",
      description: "Confirm your email",
      component: <EmailVerificationStep onComplete={() => handleStepChange(3)} />,
      isCompleted: completedSteps.has(2)
    },
    {
      id: "payment-method",
      title: "Payment Method",
      description: "Add payment info",
      component: <PaymentMethodStep onComplete={handlePaymentMethodComplete} />,
      isCompleted: completedSteps.has(3),
      isDisabled: paymentMethods.length === 0
    },
    {
      id: "welcome",
      title: "Welcome",
      description: "Get started",
      component: <WelcomeStep onComplete={handleComplete} />,
      isCompleted: completedSteps.has(4)
    }
  ];

  return (
    <OnboardingStepper
      steps={steps}
      currentStep={currentStep}
      onStepChange={handleStepChange}
      onNext={handleNext}
      onComplete={handleComplete}
      showNavigation={currentStep > 0} // Hide navigation on first step
    />
  );
};
