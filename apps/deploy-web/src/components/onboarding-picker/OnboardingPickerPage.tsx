"use client";

import React from "react";
import { useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { ArrowRight } from "lucide-react";
import Head from "next/head";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { BONUS_PERCENT, MAX_BONUS } from "@src/components/billing-usage/FirstPurchaseBonusAlert/FirstPurchaseBonusAlert";
import { DeploymentTemplatePickerCard } from "@src/components/deployments/DeploymentTemplatePickerCard/DeploymentTemplatePickerCard";
import { OnboardingHeader } from "@src/components/layout/OnboardingHeader/OnboardingHeader";
import type { DeployClickVia } from "@src/components/onboarding-picker/IntentFirstPicker/IntentFirstPicker";
import { IntentFirstPicker } from "@src/components/onboarding-picker/IntentFirstPicker/IntentFirstPicker";
import { SkipOnboardingButton } from "@src/components/onboarding-picker/SkipOnboardingButton/SkipOnboardingButton";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useMarkAutoDeployStart } from "@src/hooks/useAutoDeployStart/useAutoDeployStart";
import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";
import { useFlag } from "@src/hooks/useFlag";
import { useIsOutOfDeployCredit } from "@src/hooks/useIsOutOfDeployCredit/useIsOutOfDeployCredit";
import { useReferralQuery } from "@src/queries/useReferralQuery";

/**
 * Template ids the picker cards deploy. Each card marks its template and redirects to the bid-screening (configure) view
 * carrying its `templateId`, `sdl-strategy=default` and `bid-strategy=auto`; that view resolves the SDL and, because the
 * card marked it, starts the deployment automatically. The space-agent and chatbot ids are public gallery
 * templates; hello-world is a hardcoded template resolved by code on the configure side.
 */
const TEMPLATE_IDS = {
  helloWorld: "hello-world",
  spaceAgent: "akash-network-awesome-akash-Space-Agent",
  llmChatbot: "akash-network-awesome-akash-Llama-3.1-8B"
} as const;

const DEPLOY_CTA = { label: "Deploy now", icon: "arrow" } as const;

const ADD_CREDITS_TO_DEPLOY_CTA = { label: "Add credits to deploy", icon: "lock" } as const;

const OUT_OF_CREDIT_SHEET_DESCRIPTION = "Your balance is too low to start a deployment. Add credits, then continue to deploy this template.";

type AddCreditsPrompt = { context: "unlock-gpu" | "out-of-credit"; templateId: string } | { context: "hackathon-coupon" };

/** One shared object, so the deep-link effect re-running sets identical state and React skips the re-render instead of looping. */
const HACKATHON_COUPON_PROMPT: AddCreditsPrompt = { context: "hackathon-coupon" };

export const DEPENDENCIES = {
  useRouter,
  useSearchParams,
  useWallet,
  useEnsureTrialStarted,
  useIsOutOfDeployCredit,
  useMarkAutoDeployStart,
  useServices,
  useFlag,
  useReferralQuery,
  DeploymentTemplatePickerCard,
  AddCreditsSheet,
  OnboardingHeader,
  SkipOnboardingButton,
  IntentFirstPicker,
  Button
};

type OnboardingPickerPageProps = {
  dependencies?: typeof DEPENDENCIES;
};

export function OnboardingPickerPage({ dependencies: d = DEPENDENCIES }: OnboardingPickerPageProps) {
  const router = d.useRouter();
  const { isTrialing } = d.useWallet();
  const { publicConfig, urlService, analyticsService } = d.useServices();
  const isAffiliateProgramEnabled = d.useFlag("affiliate_program");
  const { data: referral, isLoading: isReferralLoading } = d.useReferralQuery({ enabled: isAffiliateProgramEnabled });
  const trialCreditsAmount = referral?.trialCreditsUsd ?? publicConfig.NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT;
  const [addCreditsPrompt, setAddCreditsPrompt] = useState<AddCreditsPrompt | null>(null);
  const templateIdToDeployAfterCredits = addCreditsPrompt && "templateId" in addCreditsPrompt ? addCreditsPrompt.templateId : undefined;
  const { isWalletReady } = d.useEnsureTrialStarted();
  const isOutOfCredit = d.useIsOutOfDeployCredit();
  const markAutoDeployStart = d.useMarkAutoDeployStart();
  const starterTemplateCta = isOutOfCredit ? ADD_CREDITS_TO_DEPLOY_CTA : DEPLOY_CTA;
  const isHackathonsEnabled = d.useFlag("hackathons");
  const isIntentFirst = d.useFlag("onboarding_intent_first");
  const isLlmGated = isTrialing || !isWalletReady;
  const isLlmAvailable = !isLlmGated;
  const searchParams = d.useSearchParams();
  const showHackathonEntry = isTrialing && isHackathonsEnabled;

  // Deep link for hackathon materials: /onboarding?redeemCoupon=true opens the sheet on the coupon
  // tab. The param is stripped once consumed so closing the sheet or refreshing won't re-open it;
  // until the trial/flag state resolves (both load async) the param stays untouched.
  useEffect(() => {
    if (showHackathonEntry && searchParams?.get("redeemCoupon") === "true") {
      setAddCreditsPrompt(HACKATHON_COUPON_PROMPT);
      router.replace(urlService.onboardingPicker({ intent: searchParams.get("intent") ?? undefined }), { scroll: false });
    }
  }, [showHackathonEntry, searchParams, router, urlService]);

  /** Redirects to the bid-screening view, which auto-starts the deployment from the intent params. */
  function redirectToConfigure(templateId: string) {
    markAutoDeployStart(templateId);
    router.push(urlService.configureDeployment({ templateId, sdlStrategy: "default", bidStrategy: "auto" }));
  }

  function trackDeployClick(option: string, via?: DeployClickVia) {
    analyticsService.track("onboarding_deploy_click", { category: "onboarding", option, via });
    analyticsService.flush();
  }

  function deployTemplate(templateId: string, via?: DeployClickVia) {
    trackDeployClick(templateId, via);
    if (isOutOfCredit) {
      setAddCreditsPrompt({ context: "out-of-credit", templateId });
    } else {
      redirectToConfigure(templateId);
    }
  }

  /** The LLM card reports the same deploy click whether it deploys or is credit-gated; the gated path is told apart downstream by the add-credits sheet events that follow rather than a distinct click event. */
  function deployLlmChatbot() {
    trackDeployClick(TEMPLATE_IDS.llmChatbot);
    if (isLlmAvailable) {
      redirectToConfigure(TEMPLATE_IDS.llmChatbot);
    } else {
      setAddCreditsPrompt({ context: "unlock-gpu", templateId: TEMPLATE_IDS.llmChatbot });
    }
  }

  function openHackathonCoupon() {
    setAddCreditsPrompt(HACKATHON_COUPON_PROMPT);
  }

  function closeAddCreditsPrompt() {
    setAddCreditsPrompt(null);
  }

  function continueAfterAddingCredits() {
    if (templateIdToDeployAfterCredits) {
      redirectToConfigure(templateIdToDeployAfterCredits);
    } else {
      closeAddCreditsPrompt();
    }
  }

  function trackCustomImageDeploy() {
    trackDeployClick("custom-image");
  }

  const addCreditsSheet = (
    <d.AddCreditsSheet
      open={addCreditsPrompt !== null}
      context={addCreditsPrompt?.context}
      description={addCreditsPrompt?.context === "out-of-credit" ? OUT_OF_CREDIT_SHEET_DESCRIPTION : undefined}
      onOpenChange={open => (!open ? closeAddCreditsPrompt() : undefined)}
      onRedeemed={closeAddCreditsPrompt}
      initialTab={addCreditsPrompt?.context === "hackathon-coupon" ? "coupon" : "purchase"}
      nextStepLabel={templateIdToDeployAfterCredits ? "Continue to deploy" : undefined}
      onDone={continueAfterAddingCredits}
    />
  );

  if (isIntentFirst) {
    return (
      <>
        <PageHead />
        <div className="flex min-h-dvh flex-col bg-background">
          <d.OnboardingHeader />
          <d.IntentFirstPicker
            isOutOfCredit={isOutOfCredit}
            onDeployTemplate={deployTemplate}
            onDeployImage={trackCustomImageDeploy}
            onRedeemCoupon={showHackathonEntry ? openHackathonCoupon : undefined}
          />
          {addCreditsSheet}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead />
      <div className="flex min-h-dvh flex-col bg-background">
        <d.OnboardingHeader>
          {showHackathonEntry && (
            <d.Button onClick={openHackathonCoupon} variant="ghost" size="sm">
              Hackathon? click here
              <ArrowRight className="ml-2 h-4 w-4" />
            </d.Button>
          )}
        </d.OnboardingHeader>

        <div className="mx-auto w-full max-w-5xl px-6 pt-8 [@media(max-height:520px)]:pb-12">
          <div className="flex w-full flex-col gap-10">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-3xl leading-9 text-foreground">Let&apos;s deploy your first app</h1>
              <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
                {isOutOfCredit ? (
                  <OutOfCreditIntro isTrialing={isTrialing} />
                ) : (
                  <>
                    {!isReferralLoading && (
                      <>
                        We&apos;ve provided you with{" "}
                        <span className="font-medium text-blue-600 dark:text-blue-400">${trialCreditsAmount} in free trial credits</span>. This covers a couple
                        of smaller deployments so you can see how easy it is.{" "}
                      </>
                    )}
                    Purchase your first credits to unlock our full experience - up to ${MAX_BONUS} free credits, full GPU access and 30 day deployments. Plus,
                    get {BONUS_PERCENT}% in bonus credits on your first purchase, up to ${MAX_BONUS}. Pick a template to get a live URL in about 30 seconds.
                  </>
                )}
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
              <d.DeploymentTemplatePickerCard
                recommended
                chip="Next.js"
                title="Hello world"
                description="Spin up a modern Next.js app running in a Docker container in seconds."
                priceBold="~$0.25/mo"
                priceRest=" · 0.5 vCPU · 512MiB RAM · 512MiB"
                ctaLabel={starterTemplateCta.label}
                ctaIcon={starterTemplateCta.icon}
                ctaVariant="primary"
                heroImageSrc="/images/onboarding/hello-world.png"
                heroImageAlt="Hello world template"
                onDeploy={() => deployTemplate(TEMPLATE_IDS.helloWorld)}
              />

              <d.DeploymentTemplatePickerCard
                chip="Agent Zero"
                title="Space Agent"
                description="An open-source AI agent that runs in the browser layer and can reshape its own workspace on the fly."
                priceBold="~$3.41/mo"
                priceRest=" · 4 vCPU · 8GiB RAM · 50GiB"
                ctaLabel={starterTemplateCta.label}
                ctaIcon={starterTemplateCta.icon}
                ctaVariant="outline"
                heroImageSrc="/images/onboarding/stable-diffusion.png"
                heroImageAlt="Space Agent template"
                onDeploy={() => deployTemplate(TEMPLATE_IDS.spaceAgent)}
              />

              <d.DeploymentTemplatePickerCard
                chip="Llama 3.1 8B"
                title="LLM Chatbot"
                description="Your own private AI chat. Secure, persistent, and fully under your control."
                priceBold="~$1.50/hr"
                priceRest=" · 12 vCPU · 1 GPU · 32GiB RAM · 160GiB"
                ctaLabel={isLlmGated ? "Add credits to unlock" : "Deploy now"}
                ctaIcon={isLlmGated ? "lock" : "arrow"}
                ctaVariant="outline"
                heroImageSrc="/images/onboarding/llm-chatbot.png"
                heroImageAlt="LLM chatbot template"
                onDeploy={deployLlmChatbot}
              />
            </div>

            <div className="mb-8">
              <div className="mb-6 flex w-full flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <p className="text-sm font-semibold leading-5 text-foreground">Already have a Docker Image?</p>
                  <p className="text-xs leading-5 text-muted-foreground">Recommended for experienced developers who want to get started right away.</p>
                </div>

                <Button variant="outline" className="w-full gap-2 no-underline hover:no-underline sm:w-auto" asChild>
                  <Link href={urlService.configureDeployment({ exampleImage: true })} onClick={trackCustomImageDeploy}>
                    <span>Deploy image</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="text-center">
                <d.SkipOnboardingButton source="picker" />
              </div>
            </div>
          </div>
        </div>

        {addCreditsSheet}
      </div>
    </>
  );
}

function OutOfCreditIntro({ isTrialing }: { isTrialing: boolean }) {
  if (!isTrialing) {
    return <>You&apos;re out of credits. Add credits to deploy one of these templates.</>;
  }

  return (
    <>
      Your free trial is over. Add credits to deploy one of these templates. Your first purchase gets {BONUS_PERCENT}% in bonus credits, up to ${MAX_BONUS}, and
      unlocks full GPU access and 30 day deployments.
    </>
  );
}

function PageHead() {
  return (
    <Head>
      <title>Onboarding | Akash Console</title>
      <meta name="description" content="Deploy your first app on Akash Network with our onboarding flow. Get a live URL in about 30 seconds." />
    </Head>
  );
}
