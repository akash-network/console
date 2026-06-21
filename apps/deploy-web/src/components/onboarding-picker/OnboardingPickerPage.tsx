"use client";

import React from "react";
import { useState } from "react";
import { Alert, AlertDescription, Button, Snackbar } from "@akashnetwork/ui/components";
import { ArrowRight } from "iconoir-react";
import Head from "next/head";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import { AddCreditsSheet } from "@src/components/auth/AddCreditsSheet/AddCreditsSheet";
import { DeploymentTemplatePickerCard } from "@src/components/deployments/DeploymentTemplatePickerCard/DeploymentTemplatePickerCard";
import { PhasedDeploymentContainer } from "@src/components/deployments/PhasedDeploymentContainer/PhasedDeploymentContainer";
import { AkashConsoleLogo } from "@src/components/icons/AkashConsoleLogo";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  useRouter,
  useSnackbar,
  useWallet,
  useEnsureTrialStarted,
  useServices,
  DeploymentTemplatePickerCard,
  PhasedDeploymentContainer,
  AddCreditsSheet
};

type DeployingState = {
  templateName: string;
  sdl: string;
};

type OnboardingPickerPageProps = {
  templates: {
    helloWorld: string;
    imageGen: string;
    llmChatbot: string;
  };
  dependencies?: typeof DEPENDENCIES;
};

export function OnboardingPickerPage({ templates, dependencies: d = DEPENDENCIES }: OnboardingPickerPageProps) {
  const { enqueueSnackbar } = d.useSnackbar();
  const router = d.useRouter();
  const { isTrialing } = d.useWallet();
  const { publicConfig } = d.useServices();
  const trialCreditsAmount = publicConfig.NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT;
  const [isAddCreditsSheetOpen, setIsAddCreditsSheetOpen] = useState(false);
  const [deploying, setDeploying] = useState<DeployingState | null>(null);
  const { isWalletReady, error: trialError } = d.useEnsureTrialStarted();
  const isLlmGated = isTrialing || !isWalletReady;
  const isLlmAvailable = !isLlmGated;

  return (
    <>
      <Head>
        <title>Onboarding | Akash Console</title>
        <meta name="description" content="Deploy your first app on Akash Network with our onboarding flow. Get a live URL in about 30 seconds." />
      </Head>
      <div className="flex min-h-screen flex-col bg-white dark:bg-black">
        <header className="relative flex items-center justify-between border-b border-border">
          <div className="flex h-14 items-center justify-between pl-4 pr-4">
            <AkashConsoleLogo />
          </div>
        </header>

        {deploying ? (
          <d.PhasedDeploymentContainer
            templateName={deploying.templateName}
            sdl={deploying.sdl}
            isWalletReady={isWalletReady}
            trialError={trialError}
            onSuccess={dseq => {
              enqueueSnackbar(<Snackbar title="Deployment prepared!" subTitle="We're redirecting you to the deployment details..." iconVariant="success" />, {
                variant: "success"
              });
              router.replace(UrlService.deploymentDetails(dseq));
            }}
            onCancel={() => setDeploying(null)}
          />
        ) : (
          <div className="mx-auto w-full max-w-5xl px-6 pt-8 [@media(max-height:520px)]:pb-12">
            <div className="flex w-full flex-col gap-10">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-3xl font-bold leading-9 text-foreground">Let&apos;s deploy your first app</h1>
                <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
                  We&apos;ve provided you with <span className="font-medium text-blue-600 dark:text-blue-400">${trialCreditsAmount} in free trial credits</span>
                  . Pick a template to get a live URL in about 30 seconds. Some templates require identity verification to unlock.
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
                  priceRest=" · 0.5 vCPU · 256 MB"
                  ctaLabel="Deploy now"
                  ctaVariant="primary"
                  heroImageSrc="/images/onboarding/hello-world.png"
                  heroImageAlt="Hello world template"
                  onDeploy={() => setDeploying({ templateName: "Hello world", sdl: templates.helloWorld })}
                />

                <d.DeploymentTemplatePickerCard
                  chip="Stable Diffusion"
                  title="Image Generation"
                  description="Turn your text into stunning images. Powered by Stable Diffusion XL."
                  priceBold="~$0.29/hr"
                  priceRest=" · 6 vCPU · 1 GPU · 35GB RAM"
                  ctaLabel="Deploy now"
                  ctaVariant="outline"
                  heroImageSrc="/images/onboarding/stable-diffusion.png"
                  heroImageAlt="Image generation template"
                  onDeploy={() => setDeploying({ templateName: "Image Generation", sdl: templates.imageGen })}
                />

                <d.DeploymentTemplatePickerCard
                  chip="Llama 3.1 8B"
                  title="LLM Chatbot"
                  description="Your own private AI chat. Secure, persistent, and fully under your control."
                  priceBold="~$1.50/hr"
                  priceRest=" · 1x RTX 4090 · 16 GB"
                  ctaLabel={isLlmGated ? "Unlock full trial to deploy" : "Deploy now"}
                  ctaIcon={isLlmGated ? "lock" : "arrow"}
                  ctaVariant="outline"
                  heroImageSrc="/images/onboarding/llm-chatbot.png"
                  heroImageAlt="LLM chatbot template"
                  onDeploy={() => (isLlmAvailable ? setDeploying({ templateName: "LLM Chatbot", sdl: templates.llmChatbot }) : setIsAddCreditsSheetOpen(true))}
                />
              </div>

              <div className="mb-8 flex w-full flex-col items-start gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <p className="text-sm font-semibold leading-5 text-foreground">Already have a Docker Image?</p>
                  <p className="text-xs leading-4 text-muted-foreground">Recommended for experienced developers who want to get started right away.</p>
                </div>

                <Button variant="outline" className="w-full gap-2 sm:w-auto" disabled>
                  <span>Deploy image</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <d.AddCreditsSheet
          open={isAddCreditsSheetOpen}
          onOpenChange={setIsAddCreditsSheetOpen}
          isWalletReady={isWalletReady}
          onDone={() => setIsAddCreditsSheetOpen(false)}
        />
      </div>
    </>
  );
}
