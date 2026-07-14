"use client";

import React from "react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button } from "@akashnetwork/ui/components";
import { ArrowRight } from "lucide-react";
import Head from "next/head";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { DeploymentTemplatePickerCard } from "@src/components/deployments/DeploymentTemplatePickerCard/DeploymentTemplatePickerCard";
import { AkashConsoleLogo } from "@src/components/icons/AkashConsoleLogo";
import { AccountMenu } from "@src/components/layout/AccountMenu";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";
import { useFlag } from "@src/hooks/useFlag";

/**
 * Template ids the picker cards deploy. Each card redirects to the bid-screening (configure) view carrying its
 * `templateId`; that view resolves the SDL and — because the redirect also carries `sdl-strategy=default` and
 * `bid-strategy=auto` — starts the deployment automatically. The space-agent and chatbot ids are public gallery
 * templates; hello-world is a hardcoded template resolved by code on the configure side.
 */
const TEMPLATE_IDS = {
  helloWorld: "hello-world",
  spaceAgent: "akash-network-awesome-akash-Space-Agent",
  llmChatbot: "akash-network-awesome-akash-Llama-3.1-8B"
} as const;

export const DEPENDENCIES = {
  useRouter,
  useSearchParams,
  useWallet,
  useEnsureTrialStarted,
  useServices,
  useFlag,
  DeploymentTemplatePickerCard,
  AddCreditsSheet,
  AccountMenu,
  Button
};

type OnboardingPickerPageProps = {
  dependencies?: typeof DEPENDENCIES;
};

export function OnboardingPickerPage({ dependencies: d = DEPENDENCIES }: OnboardingPickerPageProps) {
  const router = d.useRouter();
  const { isTrialing } = d.useWallet();
  const { publicConfig, urlService } = d.useServices();
  const trialCreditsAmount = publicConfig.NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT;
  const [addCreditsSheetReason, setAddCreditsSheetReason] = useState<"unlock-gpu" | "skip-trial" | "hackathon-coupon" | null>(null);
  const { isWalletReady, error: trialError, wallet } = d.useEnsureTrialStarted();
  const isHackathonsEnabled = d.useFlag("hackathons");
  const isLlmGated = isTrialing || !isWalletReady;
  const isLlmAvailable = !isLlmGated;
  const searchParams = d.useSearchParams();
  const showHackathonEntry = isTrialing && isHackathonsEnabled;

  // Deep link for hackathon materials: /onboarding?redeemCoupon=true opens the sheet on the coupon
  // tab. The param is stripped once consumed so closing the sheet or refreshing won't re-open it;
  // until the trial/flag state resolves (both load async) the param stays untouched.
  useEffect(() => {
    if (showHackathonEntry && searchParams?.get("redeemCoupon") === "true") {
      setAddCreditsSheetReason("hackathon-coupon");
      router.replace(urlService.onboardingPicker(), { scroll: false });
    }
  }, [showHackathonEntry, searchParams, router, urlService]);

  /** Redirects to the bid-screening view, which auto-starts the deployment from the intent params. */
  function deployTemplate(templateId: string) {
    router.push(urlService.configureDeployment({ templateId, sdlStrategy: "default", bidStrategy: "auto" }));
  }

  return (
    <>
      <Head>
        <title>Onboarding | Akash Console</title>
        <meta name="description" content="Deploy your first app on Akash Network with our onboarding flow. Get a live URL in about 30 seconds." />
      </Head>
      <div className="flex min-h-screen flex-col bg-white dark:bg-black">
        <header className="relative flex items-center justify-between border-b border-border">
          <div className="flex h-14 w-full items-center justify-between pl-4 pr-4">
            <AkashConsoleLogo />
            <div className="flex items-center gap-2">
              {showHackathonEntry && (
                <d.Button onClick={() => setAddCreditsSheetReason("hackathon-coupon")} variant="ghost" size="sm">
                  Hackathon? click here
                  <ArrowRight className="ml-2 h-4 w-4" />
                </d.Button>
              )}
              <d.AccountMenu minimal />
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl px-6 pt-8 [@media(max-height:520px)]:pb-12">
          <div className="flex w-full flex-col gap-10">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-3xl font-bold leading-9 text-foreground">Let&apos;s deploy your first app</h1>
              <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
                We&apos;ve provided you with <span className="font-medium text-blue-600 dark:text-blue-400">${trialCreditsAmount} in free trial credits</span>.
                Pick a template to get a live URL in about 30 seconds. Some templates require identity verification to unlock.
              </p>
            </div>

            {trialError && (
              <Alert variant="destructive">
                <AlertDescription>
                  We couldn&apos;t set up your trial. Please refresh the page to try again, or contact support if the issue persists.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
              <d.DeploymentTemplatePickerCard
                recommended
                chip="Next.js"
                title="Hello world"
                description="Spin up a modern Next.js app running in a Docker container in seconds."
                priceBold="~$0.25/mo"
                priceRest=" · 0.5 vCPU · 512MiB RAM · 512MiB"
                ctaLabel="Deploy now"
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
                ctaLabel="Deploy now"
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
                onDeploy={() => (isLlmAvailable ? deployTemplate(TEMPLATE_IDS.llmChatbot) : setAddCreditsSheetReason("unlock-gpu"))}
              />
            </div>

            <div className="mb-8">
              <div className="mb-6 flex w-full flex-col items-start gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <p className="text-sm font-semibold leading-5 text-foreground">Already have a Docker Image?</p>
                  <p className="text-xs leading-4 text-muted-foreground">Recommended for experienced developers who want to get started right away.</p>
                </div>

                <Button variant="outline" className="w-full gap-2 no-underline hover:no-underline sm:w-auto" asChild>
                  <Link href={urlService.configureDeployment()}>
                    <span>Deploy image</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {(isTrialing || !wallet?.creditAmount) && (
                <div className="text-center">
                  <d.Button onClick={() => setAddCreditsSheetReason("skip-trial")} variant="ghost">
                    Skip the trial - unlock Console
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </d.Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <d.AddCreditsSheet
          open={addCreditsSheetReason !== null}
          onOpenChange={open => setAddCreditsSheetReason(open ? "unlock-gpu" : null)}
          isWalletReady={isWalletReady}
          onRedeemed={() => setAddCreditsSheetReason(null)}
          initialTab={addCreditsSheetReason === "hackathon-coupon" ? "coupon" : "purchase"}
          onDone={() => {
            if (addCreditsSheetReason === "unlock-gpu") {
              deployTemplate(TEMPLATE_IDS.llmChatbot);
            } else if (addCreditsSheetReason === "skip-trial") {
              router.push(urlService.configureDeployment());
            } else {
              setAddCreditsSheetReason(null);
            }
          }}
        />
      </div>
    </>
  );
}
