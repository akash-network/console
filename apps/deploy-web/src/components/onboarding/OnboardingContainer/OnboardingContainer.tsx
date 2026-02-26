"use client";
import type { ReactNode } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useRouter, useSearchParams } from "next/navigation";

import { SuccessAnimation } from "@src/components/shared";
import { useCertificate } from "@src/context/CertificateProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useChainParam } from "@src/hooks/useChainParam/useChainParam";
import { useManagedWalletDenom } from "@src/hooks/useManagedWalletDenom";
import { useNotificator } from "@src/hooks/useNotificator";
import { useReturnTo } from "@src/hooks/useReturnTo";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMethodsQuery } from "@src/queries/usePaymentQueries";
import { RouteStep } from "@src/types/route-steps.type";
import { deploymentData } from "@src/utils/deploymentData";
import { appendAuditorRequirement } from "@src/utils/deploymentData/v1beta3";
import { validateDeploymentData } from "@src/utils/deploymentUtils";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { helloWorldTemplate } from "@src/utils/templates";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { type OnboardingStep } from "../OnboardingStepper/OnboardingStepper";

export enum OnboardingStepIndex {
  FREE_TRIAL = 0,
  SIGNUP = 1,
  EMAIL_VERIFICATION = 2,
  PAYMENT_METHOD = 3,
  WELCOME = 4
}

export type OnboardingContainerProps = {
  children: (props: {
    isLoading: boolean;
    currentStep: number;
    steps: OnboardingStep[];
    onStepChange: (step: number) => void;
    onStepComplete: (step: OnboardingStepIndex) => void;
    onStartTrial: () => void;
    onPaymentMethodComplete: () => void;
    onComplete: (templateName?: string) => Promise<void>;
  }) => ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

const DEPENDENCIES = {
  useUser,
  usePaymentMethodsQuery,
  useChainParam,
  useServices,
  useRouter,
  useWallet,
  useCertificate,
  useNotificator,
  useManagedWalletDenom,
  useReturnTo,
  deploymentData,
  validateDeploymentData,
  appendAuditorRequirement,
  helloWorldTemplate,
  TransactionMessageData,
  useSearchParams,
  denomToUdenom
};

function inferStep(user: { userId?: string; emailVerified?: boolean } | undefined, hasManagedWallet: boolean): OnboardingStepIndex {
  if (!user?.userId) return OnboardingStepIndex.FREE_TRIAL;
  if (!user.emailVerified) return OnboardingStepIndex.EMAIL_VERIFICATION;
  if (!hasManagedWallet) return OnboardingStepIndex.PAYMENT_METHOD;
  return OnboardingStepIndex.WELCOME;
}

function deriveCompletedSteps(step: OnboardingStepIndex): Set<OnboardingStepIndex> {
  const completed = new Set<OnboardingStepIndex>();
  const allSteps = [OnboardingStepIndex.FREE_TRIAL, OnboardingStepIndex.SIGNUP, OnboardingStepIndex.EMAIL_VERIFICATION, OnboardingStepIndex.PAYMENT_METHOD];
  for (const s of allSteps) {
    if (s < step) completed.add(s);
  }
  return completed;
}

export const OnboardingContainer: React.FunctionComponent<OnboardingContainerProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const { user, isLoading: isUserLoading } = d.useUser();
  const { data: paymentMethods = [], isLoading: isPaymentMethodsLoading } = d.usePaymentMethodsQuery({ enabled: !!user?.stripeCustomerId });
  const { minDeposit } = d.useChainParam();
  const {
    analyticsService,
    urlService,
    chainApiHttpClient,
    deploymentLocalStorage,
    errorHandler,
    windowLocation,
    windowHistory,
    template: templateService
  } = d.useServices();
  const { hasManagedWallet, isWalletLoading, connectManagedWallet, address, signAndBroadcastTx } = d.useWallet();
  const { genNewCertificateIfLocalIsInvalid, updateSelectedCertificate } = d.useCertificate();
  const notificator = d.useNotificator();
  const managedDenom = d.useManagedWalletDenom();
  const { navigateBack } = d.useReturnTo({ defaultReturnTo: "/" });

  const isLoading = isUserLoading || isWalletLoading || (!!user?.stripeCustomerId && isPaymentMethodsLoading);

  const currentStep = useMemo(() => {
    if (isLoading) return OnboardingStepIndex.FREE_TRIAL;
    return inferStep(user, hasManagedWallet);
  }, [isLoading, user, hasManagedWallet]);

  const completedSteps = useMemo(() => deriveCompletedSteps(currentStep), [currentStep]);

  const fromSignupHandledRef = useRef(false);
  useEffect(() => {
    if (fromSignupHandledRef.current) return;
    const fromSignup = searchParams.get("fromSignup");
    if (fromSignup === "true") {
      fromSignupHandledRef.current = true;
      analyticsService.track("onboarding_account_created", {
        category: "onboarding"
      });

      const newUrl = new URL(windowLocation.href);
      newUrl.searchParams.delete("fromSignup");
      windowHistory.replaceState({}, "", newUrl.toString());
    }
  }, [analyticsService, searchParams, windowLocation, windowHistory]);

  const prevStepRef = useRef<OnboardingStepIndex | null>(null);
  useEffect(() => {
    if (isLoading) return;

    if (prevStepRef.current === null) {
      prevStepRef.current = currentStep;
      return;
    }

    if (prevStepRef.current === OnboardingStepIndex.PAYMENT_METHOD && currentStep === OnboardingStepIndex.WELCOME) {
      analyticsService.track("onboarding_payment_method_added", {
        category: "onboarding"
      });
      analyticsService.track("onboarding_step_completed", {
        category: "onboarding",
        step: "payment_method",
        step_index: OnboardingStepIndex.PAYMENT_METHOD
      });
      setShowSuccessAnimation(true);
    }

    prevStepRef.current = currentStep;
  }, [isLoading, currentStep, analyticsService]);

  const handleStepChange = useCallback(
    (step: number) => {
      const stepNames = ["free_trial", "signup", "email_verification", "payment_method", "welcome"];
      analyticsService.track("onboarding_step_started", {
        category: "onboarding",
        step: stepNames[step],
        step_index: step
      });
    },
    [analyticsService]
  );

  const handleStepComplete = useCallback(
    (step: OnboardingStepIndex) => {
      const stepNames = ["free_trial", "signup", "email_verification", "payment_method", "welcome"];
      analyticsService.track("onboarding_step_completed", {
        category: "onboarding",
        step: stepNames[step],
        step_index: step
      });
    },
    [analyticsService]
  );

  const handleStartTrial = useCallback(() => {
    analyticsService.track("onboarding_free_trial_started", {
      category: "onboarding"
    });

    handleStepComplete(OnboardingStepIndex.FREE_TRIAL);

    if (user?.userId) {
      if (user.emailVerified) {
        handleStepChange(OnboardingStepIndex.PAYMENT_METHOD);
      } else {
        handleStepChange(OnboardingStepIndex.EMAIL_VERIFICATION);
      }
    } else {
      router.push(urlService.newSignup({ fromSignup: "true" }));
    }
  }, [analyticsService, handleStepComplete, user?.userId, user?.emailVerified, handleStepChange, router, urlService]);

  const handlePaymentMethodComplete = useCallback(() => {
    // Animation and analytics are handled by the step-transition effect
    // This callback exists for PaymentMethodContainer's onComplete
  }, []);

  const handleSuccessAnimationComplete = useCallback(() => {
    setShowSuccessAnimation(false);
    handleStepChange(OnboardingStepIndex.WELCOME);
  }, [handleStepChange]);

  const complete = useCallback(
    async (templateName?: string) => {
      if (!templateName) {
        navigateBack();
        return;
      }

      try {
        const templateMap: Record<string, { id?: string; sdl: string; name: string }> = {
          "hello-akash": {
            sdl: d.helloWorldTemplate.content,
            name: "Hello Akash"
          },
          comfyui: {
            id: "akash-network-awesome-akash-comfyui",
            sdl: "",
            name: "ComfyUI"
          },
          "llama-3.1-8b": {
            id: "akash-network-awesome-akash-Llama-3.1-8B",
            sdl: "",
            name: "Llama 3.1 8B"
          }
        };

        const templateConfig = templateMap[templateName];
        if (!templateConfig) {
          const error = new Error(`Template ${templateName} not found`);
          errorHandler.reportError({
            error,
            severity: "warning",
            tags: { component: "onboarding", template: templateName }
          });
          notificator.error(`Template "${templateName}" is no longer supported, please choose another one`);
          return;
        }

        let sdl = templateConfig.sdl;

        if (templateConfig.id) {
          const template = await templateService.findById(templateConfig.id);
          if (!template || !template.deploy) {
            const error = new Error(`Template ${templateName} SDL not found`);
            errorHandler.reportError({
              error,
              severity: "warning",
              tags: { component: "onboarding", template: templateName, templateId: templateConfig.id }
            });
            notificator.error(`Template "${templateConfig.name}" is no longer supported, please choose another one`);
            return;
          }
          sdl = template.deploy;
        }

        sdl = d.appendAuditorRequirement(sdl);
        const isUsdc = managedDenom && managedDenom !== "uakt";
        if (isUsdc) {
          sdl = sdl.replace(/uakt/g, managedDenom);
        }

        const minDepositAmount = isUsdc ? minDeposit.usdc : minDeposit.akt;
        const deposit = d.denomToUdenom(minDepositAmount);
        const dd = await d.deploymentData.NewDeploymentData(chainApiHttpClient, sdl, null, address, deposit);
        d.validateDeploymentData(dd, null);

        if (!dd) {
          throw new Error("Failed to create deployment data");
        }

        const messages: EncodeObject[] = [];
        const newCert = await genNewCertificateIfLocalIsInvalid();

        if (newCert) {
          messages.push(d.TransactionMessageData.getCreateCertificateMsg(address, newCert.cert, newCert.publicKey));
        }

        messages.push(d.TransactionMessageData.getCreateDeploymentMsg(dd));
        const response = await signAndBroadcastTx(messages);

        if (response) {
          if (newCert) {
            await updateSelectedCertificate(newCert);
          }

          deploymentLocalStorage.update(address, dd.deploymentId.dseq, {
            manifest: sdl,
            manifestVersion: dd.hash,
            name: templateConfig.name
          });

          analyticsService.track("create_deployment", {
            category: "onboarding",
            template: templateName,
            dseq: dd.deploymentId.dseq
          });

          connectManagedWallet();
          router.push(urlService.newDeployment({ step: RouteStep.createLeases, dseq: dd.deploymentId.dseq }));
        }
      } catch (error) {
        notificator.error("Failed to deploy template. Please try again.");
      }
    },
    [
      d,
      router,
      urlService,
      connectManagedWallet,
      templateService,
      chainApiHttpClient,
      address,
      minDeposit,
      genNewCertificateIfLocalIsInvalid,
      signAndBroadcastTx,
      updateSelectedCertificate,
      deploymentLocalStorage,
      analyticsService,
      notificator,
      errorHandler,
      managedDenom,
      navigateBack
    ]
  );

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
        isLoading,
        currentStep,
        steps,
        onStepChange: handleStepChange,
        onStepComplete: handleStepComplete,
        onStartTrial: handleStartTrial,
        onPaymentMethodComplete: handlePaymentMethodComplete,
        onComplete: complete
      })}
      <SuccessAnimation show={showSuccessAnimation} onComplete={handleSuccessAnimationComplete} />
    </>
  );
};
