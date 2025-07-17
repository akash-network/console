"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useUser } from "@src/hooks/useUser";
import { usePaymentMethodsQuery } from "@src/queries/usePaymentQueries";
import { UrlService } from "@src/utils/urlUtils";
import { type OnboardingStep, OnboardingStepper } from "../OnboardingStepper/OnboardingStepper";
import { EmailVerificationStep } from "../steps/EmailVerificationStep/EmailVerificationStep";
import { FreeTrialLandingStep } from "../steps/FreeTrialLandingStep/FreeTrialLandingStep";
import { PaymentMethodStep } from "../steps/PaymentMethodStep/PaymentMethodStep";
import { WelcomeStep } from "../steps/WelcomeStep/WelcomeStep";

enum OnboardingStepIndex {
  FREE_TRIAL = 0,
  SIGNUP = 1,
  EMAIL_VERIFICATION = 2,
  PAYMENT_METHOD = 3,
  WELCOME = 4
}

export const OnboardingContainer: React.FunctionComponent = () => {
  const [currentStep, setCurrentStep] = useState(OnboardingStepIndex.FREE_TRIAL);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStepIndex>>(new Set());
  const router = useRouter();
  const { data: paymentMethods = [] } = usePaymentMethodsQuery();
  const user = useUser();

  useEffect(() => {
    const savedStep = localStorage.getItem("onboardingStep");
    if (savedStep) {
      const step = parseInt(savedStep, 10);
      if (step >= 0 && step < Object.keys(OnboardingStepIndex).length / 2) {
        setCurrentStep(step);
      }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const fromSignup = urlParams.get("fromSignup");
    if (fromSignup === "true") {
      setCompletedSteps(prev => new Set([...prev, OnboardingStepIndex.SIGNUP]));
      setCurrentStep(OnboardingStepIndex.EMAIL_VERIFICATION);
      localStorage.setItem("onboardingStep", OnboardingStepIndex.EMAIL_VERIFICATION.toString());

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("fromSignup");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, []);

  const handleStepChange = (step: number) => {
    if (step === OnboardingStepIndex.PAYMENT_METHOD && currentStep === OnboardingStepIndex.EMAIL_VERIFICATION) {
      if (!user?.emailVerified) {
        return;
      }
    }

    if (step === OnboardingStepIndex.WELCOME && currentStep === OnboardingStepIndex.PAYMENT_METHOD) {
      if (paymentMethods.length === 0) {
        return;
      }
    }

    setCurrentStep(step);
    localStorage.setItem("onboardingStep", step.toString());
  };

  const handleStepComplete = (step: OnboardingStepIndex) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const handleComplete = () => {
    localStorage.removeItem("onboardingStep");
    router.push("/");
  };

  const handleStartTrial = () => {
    handleStepComplete(OnboardingStepIndex.FREE_TRIAL);

    const returnUrl = `${window.location.origin}${UrlService.onboarding(true)}`;
    const signupUrl = `${UrlService.signup()}?returnTo=${encodeURIComponent(returnUrl)}`;
    window.location.href = signupUrl;
  };

  const handlePaymentMethodComplete = () => {
    if (paymentMethods.length > 0) {
      handleStepComplete(OnboardingStepIndex.PAYMENT_METHOD);
      handleStepChange(OnboardingStepIndex.WELCOME);
    }
  };

  const steps: OnboardingStep[] = [
    {
      id: "free-trial",
      title: "Free Trial",
      description: "Learn about benefits",
      component: <FreeTrialLandingStep onStartTrial={handleStartTrial} />,
      isCompleted: completedSteps.has(OnboardingStepIndex.FREE_TRIAL)
    },
    {
      id: "signup",
      title: "Create Account",
      description: "Sign up with Auth0",
      component: null, // No component needed for redirect step
      isCompleted: completedSteps.has(OnboardingStepIndex.SIGNUP)
    },
    {
      id: "email-verification",
      title: "Verify Email",
      description: "Confirm your email",
      component: <EmailVerificationStep onComplete={() => handleStepChange(OnboardingStepIndex.PAYMENT_METHOD)} />,
      isCompleted: completedSteps.has(OnboardingStepIndex.EMAIL_VERIFICATION),
      isDisabled: !user?.emailVerified,
      hidePreviousButton: true
    },
    {
      id: "payment-method",
      title: "Payment Method",
      description: "Add payment info",
      component: <PaymentMethodStep onComplete={handlePaymentMethodComplete} />,
      isCompleted: completedSteps.has(OnboardingStepIndex.PAYMENT_METHOD),
      isDisabled: paymentMethods.length === 0
    },
    {
      id: "welcome",
      title: "Welcome",
      description: "Get started",
      component: <WelcomeStep onComplete={handleComplete} />,
      isCompleted: completedSteps.has(OnboardingStepIndex.WELCOME)
    }
  ];

  return <OnboardingStepper steps={steps} currentStep={currentStep} />;
};
