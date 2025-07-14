"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  // Initialize step from URL or localStorage
  useEffect(() => {
    const savedStep = localStorage.getItem("onboardingStep");
    if (savedStep) {
      const step = parseInt(savedStep, 10);
      if (step >= 0 && step < 5) {
        setCurrentStep(step);
      }
    }

    // Check if user is returning from Auth0 signup
    const urlParams = new URLSearchParams(window.location.search);
    const fromSignup = urlParams.get("fromSignup");
    if (fromSignup === "true") {
      // Mark signup step as completed and move to email verification
      setCompletedSteps(prev => new Set([...prev, 1]));
      setCurrentStep(2); // Email verification step
      localStorage.setItem("onboardingStep", "2");

      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("fromSignup");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, []);

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
    localStorage.setItem("onboardingStep", step.toString());
  };

  const handleStepComplete = (step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const handleNext = () => {
    handleStepComplete(currentStep);
  };

  const handleComplete = () => {
    // Clear onboarding state and redirect to dashboard
    localStorage.removeItem("onboardingStep");
    router.push("/");
  };

  const handleStartTrial = () => {
    // Mark free trial step as completed
    handleStepComplete(0);

    // Redirect to Auth0 signup with return URL to onboarding
    const returnUrl = `${window.location.origin}${UrlService.onboarding(true)}`;
    const signupUrl = `${UrlService.signup()}?returnTo=${encodeURIComponent(returnUrl)}`;
    window.location.href = signupUrl;
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
      component: <PaymentMethodStep onComplete={() => handleStepChange(4)} />,
      isCompleted: completedSteps.has(3)
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
