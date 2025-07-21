"use client";
import type { ReactNode } from "react";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMethodsQuery } from "@src/queries/usePaymentQueries";
import { UrlService } from "@src/utils/urlUtils";

export enum OnboardingStepIndex {
  FREE_TRIAL = 0,
  SIGNUP = 1,
  EMAIL_VERIFICATION = 2,
  PAYMENT_METHOD = 3,
  WELCOME = 4
}

export type OnboardingStep = {
  id: string;
  title: string;
  description?: string;
  component: ReactNode | null;
  isCompleted?: boolean;
  isDisabled?: boolean;
  hidePreviousButton?: boolean;
};

export type OnboardingContainerProps = {
  children: (props: {
    currentStep: number;
    steps: OnboardingStep[];
    onStepChange: (step: number) => void;
    onStepComplete: (step: OnboardingStepIndex) => void;
    onStartTrial: () => void;
    onPaymentMethodComplete: () => void;
    onComplete: () => void;
  }) => ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

const DEPENDENCIES = {
  useUser,
  usePaymentMethodsQuery,
  useServices,
  useRouter,
  UrlService
};

export const OnboardingContainer: React.FunctionComponent<OnboardingContainerProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const [currentStep, setCurrentStep] = useState(OnboardingStepIndex.FREE_TRIAL);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStepIndex>>(new Set());

  const router = d.useRouter();
  const { data: paymentMethods = [] } = d.usePaymentMethodsQuery();
  const user = d.useUser();
  const { analyticsService } = d.useServices();

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
      analyticsService.track("onboarding_account_created", {
        category: "onboarding"
      });

      setCompletedSteps(prev => new Set([...prev, OnboardingStepIndex.SIGNUP]));
      setCurrentStep(OnboardingStepIndex.EMAIL_VERIFICATION);
      localStorage.setItem("onboardingStep", OnboardingStepIndex.EMAIL_VERIFICATION.toString());

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("fromSignup");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [analyticsService]);

  const handleStepChange = useCallback(
    (step: number) => {
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

      const stepNames = ["free_trial", "signup", "email_verification", "payment_method", "welcome"];
      analyticsService.track("onboarding_step_started", {
        category: "onboarding",
        step: stepNames[step],
        step_index: step
      });

      setCurrentStep(step);
      localStorage.setItem("onboardingStep", step.toString());
    },
    [currentStep, user?.emailVerified, paymentMethods.length, analyticsService]
  );

  const handleStepComplete = useCallback(
    (step: OnboardingStepIndex) => {
      const stepNames = ["free_trial", "signup", "email_verification", "payment_method", "welcome"];
      analyticsService.track("onboarding_step_completed", {
        category: "onboarding",
        step: stepNames[step],
        step_index: step
      });

      setCompletedSteps(prev => new Set([...prev, step]));
    },
    [analyticsService]
  );

  const handleComplete = useCallback(() => {
    localStorage.removeItem("onboardingStep");
    router.push("/");
  }, [router]);

  const handleStartTrial = useCallback(() => {
    analyticsService.track("onboarding_free_trial_started", {
      category: "onboarding"
    });

    handleStepComplete(OnboardingStepIndex.FREE_TRIAL);

    const returnUrl = `${window.location.origin}${d.UrlService.onboarding(true)}`;
    const signupUrl = `${d.UrlService.signup()}?returnTo=${encodeURIComponent(returnUrl)}`;
    window.location.href = signupUrl;
  }, [analyticsService, handleStepComplete, d.UrlService]);

  const handlePaymentMethodComplete = useCallback(() => {
    if (paymentMethods.length > 0) {
      analyticsService.track("onboarding_payment_method_added", {
        category: "onboarding"
      });

      handleStepComplete(OnboardingStepIndex.PAYMENT_METHOD);
      handleStepChange(OnboardingStepIndex.WELCOME);
    }
  }, [paymentMethods.length, analyticsService, handleStepComplete, handleStepChange]);

  const steps: OnboardingStep[] = [
    {
      id: "free-trial",
      title: "Free Trial",
      description: "Learn about benefits",
      component: null,
      isCompleted: completedSteps.has(OnboardingStepIndex.FREE_TRIAL)
    },
    {
      id: "signup",
      title: "Create Account",
      description: "Sign up with Auth0",
      component: null,
      isCompleted: completedSteps.has(OnboardingStepIndex.SIGNUP)
    },
    {
      id: "email-verification",
      title: "Verify Email",
      description: "Confirm your email",
      component: null,
      isCompleted: completedSteps.has(OnboardingStepIndex.EMAIL_VERIFICATION),
      isDisabled: !user?.emailVerified,
      hidePreviousButton: true
    },
    {
      id: "payment-method",
      title: "Payment Method",
      description: "Add payment info",
      component: null,
      isCompleted: completedSteps.has(OnboardingStepIndex.PAYMENT_METHOD),
      isDisabled: paymentMethods.length === 0
    },
    {
      id: "welcome",
      title: "Welcome",
      description: "Get started",
      component: null,
      isCompleted: completedSteps.has(OnboardingStepIndex.WELCOME)
    }
  ];

  return (
    <>
      {children({
        currentStep,
        steps,
        onStepChange: handleStepChange,
        onStepComplete: handleStepComplete,
        onStartTrial: handleStartTrial,
        onPaymentMethodComplete: handlePaymentMethodComplete,
        onComplete: handleComplete
      })}
    </>
  );
};
