"use client";
import type { ReactNode } from "react";
import React, { useCallback, useEffect, useState } from "react";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";

import { SuccessAnimation } from "@src/components/shared";
import { useCertificate } from "@src/context/CertificateProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useChainParam } from "@src/hooks/useChainParam/useChainParam";
import { useManagedWalletDenom } from "@src/hooks/useManagedWalletDenom";
import { useReturnTo } from "@src/hooks/useReturnTo";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMethodsQuery } from "@src/queries/usePaymentQueries";
import { useTemplates } from "@src/queries/useTemplateQuery";
import { ONBOARDING_STEP_KEY } from "@src/services/storage/keys";
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
  useTemplates,
  useCertificate,
  useSnackbar,
  useManagedWalletDenom,
  useReturnTo,
  localStorage: typeof window !== "undefined" ? window.localStorage : null,
  deploymentData,
  validateDeploymentData,
  appendAuditorRequirement,
  helloWorldTemplate,
  TransactionMessageData,
  useSearchParams,
  denomToUdenom
};

export const OnboardingContainer: React.FunctionComponent<OnboardingContainerProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const [currentStep, setCurrentStep] = useState(OnboardingStepIndex.FREE_TRIAL);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStepIndex>>(new Set());
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const { user } = d.useUser();
  const { data: paymentMethods = [] } = d.usePaymentMethodsQuery({ enabled: !!user?.stripeCustomerId });
  const { minDeposit } = d.useChainParam();
  const { analyticsService, urlService, chainApiHttpClient, deploymentLocalStorage, errorHandler, windowLocation, windowHistory } = d.useServices();
  const { hasManagedWallet, isWalletLoading, connectManagedWallet, address, signAndBroadcastTx } = d.useWallet();
  const { templates } = d.useTemplates();
  const { genNewCertificateIfLocalIsInvalid, updateSelectedCertificate } = d.useCertificate();
  const { enqueueSnackbar } = d.useSnackbar();
  const managedDenom = d.useManagedWalletDenom();
  const { navigateBack } = d.useReturnTo({ defaultReturnTo: "/" });

  useEffect(() => {
    const savedStep = d.localStorage?.getItem(ONBOARDING_STEP_KEY);
    if (!isWalletLoading && hasManagedWallet && !savedStep) {
      navigateBack();
    }
  }, [isWalletLoading, hasManagedWallet, d.localStorage, navigateBack]);

  useEffect(() => {
    const savedStep = d.localStorage?.getItem(ONBOARDING_STEP_KEY);
    if (savedStep) {
      const step = parseInt(savedStep, 10);
      if (step >= 0 && step < Object.keys(OnboardingStepIndex).length / 2) {
        setCurrentStep(step);
      }
    }

    const fromSignup = searchParams.get("fromSignup");
    if (fromSignup === "true") {
      analyticsService.track("onboarding_account_created", {
        category: "onboarding"
      });

      setCompletedSteps(prev => new Set([...prev, OnboardingStepIndex.SIGNUP]));
      setCurrentStep(OnboardingStepIndex.EMAIL_VERIFICATION);
      d.localStorage?.setItem(ONBOARDING_STEP_KEY, OnboardingStepIndex.EMAIL_VERIFICATION.toString());

      const newUrl = new URL(windowLocation.href);
      newUrl.searchParams.delete("fromSignup");
      windowHistory.replaceState({}, "", newUrl.toString());
    }
  }, [analyticsService, d.localStorage, searchParams, windowLocation, windowHistory]);

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
      d.localStorage?.setItem(ONBOARDING_STEP_KEY, step.toString());
    },
    [currentStep, user?.emailVerified, paymentMethods.length, analyticsService, d.localStorage]
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

  const handleStartTrial = useCallback(() => {
    analyticsService.track("onboarding_free_trial_started", {
      category: "onboarding"
    });

    handleStepComplete(OnboardingStepIndex.FREE_TRIAL);

    if (user?.userId) {
      if (user.emailVerified) {
        setCompletedSteps(prev => new Set([...prev, OnboardingStepIndex.SIGNUP, OnboardingStepIndex.EMAIL_VERIFICATION]));
        handleStepChange(OnboardingStepIndex.PAYMENT_METHOD);
      } else {
        setCompletedSteps(prev => new Set([...prev, OnboardingStepIndex.SIGNUP]));
        handleStepChange(OnboardingStepIndex.EMAIL_VERIFICATION);
      }
    } else {
      router.push(urlService.newSignup({ fromSignup: "true" }) + "&fromSignup=true");
    }
  }, [analyticsService, handleStepComplete, user?.userId, user?.emailVerified, handleStepChange, router, urlService]);

  const handlePaymentMethodComplete = useCallback(() => {
    if (paymentMethods.length > 0) {
      analyticsService.track("onboarding_payment_method_added", {
        category: "onboarding"
      });

      handleStepComplete(OnboardingStepIndex.PAYMENT_METHOD);
      setShowSuccessAnimation(true);
    }
  }, [paymentMethods.length, analyticsService, handleStepComplete]);

  const handleSuccessAnimationComplete = useCallback(() => {
    setShowSuccessAnimation(false);
    handleStepChange(OnboardingStepIndex.WELCOME);
  }, [handleStepChange]);

  const complete = useCallback(
    async (templateName?: string) => {
      if (!templateName) {
        d.localStorage?.removeItem(ONBOARDING_STEP_KEY);
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
          enqueueSnackbar(`Template "${templateName}" is no longer supported, please choose another one`, { variant: "error" });
          return;
        }

        let sdl = templateConfig.sdl;

        if (templateConfig.id) {
          const template = templates.find(t => t.id === templateConfig.id);
          if (!template || !template.deploy) {
            const error = new Error(`Template ${templateName} SDL not found`);
            errorHandler.reportError({
              error,
              severity: "warning",
              tags: { component: "onboarding", template: templateName, templateId: templateConfig.id }
            });
            enqueueSnackbar(`Template "${templateConfig.name}" is no longer supported, please choose another one`, { variant: "error" });
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

          d.localStorage?.removeItem(ONBOARDING_STEP_KEY);
          connectManagedWallet();
          router.push(urlService.newDeployment({ step: RouteStep.createLeases, dseq: dd.deploymentId.dseq }));
        }
      } catch (error) {
        enqueueSnackbar("Failed to deploy template. Please try again.", { variant: "error" });
      }
    },
    [
      d,
      router,
      urlService,
      connectManagedWallet,
      templates,
      chainApiHttpClient,
      address,
      minDeposit,
      genNewCertificateIfLocalIsInvalid,
      signAndBroadcastTx,
      updateSelectedCertificate,
      deploymentLocalStorage,
      analyticsService,
      enqueueSnackbar,
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
