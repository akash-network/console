"use client";
import type { ReactNode } from "react";
import React, { useCallback, useEffect, useState } from "react";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import { useCertificate } from "@src/context/CertificateProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMethodsQuery } from "@src/queries/usePaymentQueries";
import { useTemplates } from "@src/queries/useTemplateQuery";
import { ONBOARDING_STEP_KEY } from "@src/services/storage/keys";
import { RouteStep } from "@src/types/route-steps.type";
import { deploymentData } from "@src/utils/deploymentData";
import { appendAuditorRequirement } from "@src/utils/deploymentData/v1beta3";
import { validateDeploymentData } from "@src/utils/deploymentUtils";
import { helloWorldTemplate } from "@src/utils/templates";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
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
    onComplete: (templateName: string) => Promise<void>;
  }) => ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

const DEPENDENCIES = {
  useUser,
  usePaymentMethodsQuery,
  useServices,
  useRouter,
  useWallet,
  useTemplates,
  useCertificate,
  useSnackbar,
  localStorage: typeof window !== "undefined" ? window.localStorage : null,
  deploymentData,
  validateDeploymentData,
  appendAuditorRequirement,
  helloWorldTemplate,
  TransactionMessageData,
  UrlService
};

export const OnboardingContainer: React.FunctionComponent<OnboardingContainerProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const [currentStep, setCurrentStep] = useState(OnboardingStepIndex.FREE_TRIAL);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStepIndex>>(new Set());

  const router = d.useRouter();
  const { user } = d.useUser();
  const { data: paymentMethods = [] } = d.usePaymentMethodsQuery({ enabled: !!user?.stripeCustomerId });
  const { analyticsService, urlService, authService, chainApiHttpClient, deploymentLocalStorage, appConfig, errorHandler, windowLocation, windowHistory } =
    d.useServices();
  const { hasManagedWallet, isWalletLoading, connectManagedWallet, address, signAndBroadcastTx } = d.useWallet();
  const { templates } = d.useTemplates();
  const { genNewCertificateIfLocalIsInvalid, updateSelectedCertificate } = d.useCertificate();
  const { enqueueSnackbar } = d.useSnackbar();

  useEffect(() => {
    const savedStep = d.localStorage?.getItem(ONBOARDING_STEP_KEY);
    if (!isWalletLoading && hasManagedWallet && !savedStep) {
      router.replace("/");
    }
  }, [isWalletLoading, hasManagedWallet, router, d.localStorage]);

  useEffect(() => {
    const savedStep = d.localStorage?.getItem(ONBOARDING_STEP_KEY);
    if (savedStep) {
      const step = parseInt(savedStep, 10);
      if (step >= 0 && step < Object.keys(OnboardingStepIndex).length / 2) {
        setCurrentStep(step);
      }
    }

    const urlParams = new URLSearchParams(windowLocation.search);
    const fromSignup = urlParams.get("fromSignup");
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
  }, [analyticsService, d.localStorage]);

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
      authService.signup({ returnTo: `${windowLocation.origin}${urlService.onboarding(true)}` });
    }
  }, [analyticsService, handleStepComplete, urlService, user, handleStepChange, authService]);

  const handlePaymentMethodComplete = useCallback(() => {
    if (paymentMethods.length > 0) {
      analyticsService.track("onboarding_payment_method_added", {
        category: "onboarding"
      });

      handleStepComplete(OnboardingStepIndex.PAYMENT_METHOD);
      handleStepChange(OnboardingStepIndex.WELCOME);
    }
  }, [paymentMethods.length, analyticsService, handleStepComplete, handleStepChange]);

  const handleComplete = useCallback(
    async (templateName: string) => {
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

        const deposit = appConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT;
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
          router.push(d.UrlService.newDeployment({ step: RouteStep.createLeases, dseq: dd.deploymentId.dseq }));
        }
      } catch (error) {
        enqueueSnackbar("Failed to deploy template. Please try again.", { variant: "error" });
        throw error;
      }
    },
    [
      d,
      router,
      connectManagedWallet,
      templates,
      chainApiHttpClient,
      address,
      appConfig,
      genNewCertificateIfLocalIsInvalid,
      signAndBroadcastTx,
      updateSelectedCertificate,
      deploymentLocalStorage,
      analyticsService,
      enqueueSnackbar,
      errorHandler
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
        onComplete: handleComplete
      })}
    </>
  );
};
