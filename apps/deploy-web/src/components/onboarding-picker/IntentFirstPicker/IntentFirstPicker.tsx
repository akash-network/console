"use client";

import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Container, LayoutTemplate, Sparkles, Terminal } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { DeploymentTemplatePickerCard } from "@src/components/deployments/DeploymentTemplatePickerCard/DeploymentTemplatePickerCard";
import { ApiKeySetup } from "@src/components/onboarding-picker/ApiKeySetup/ApiKeySetup";
import { useOnboardingApiKey } from "@src/components/onboarding-picker/ApiKeySetup/useOnboardingApiKey";
import {
  describeTemplateSize,
  ONBOARDING_SLOTS,
  pickOnboardingCards,
  trialLimitsFrom
} from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import { RunModelPath } from "@src/components/onboarding-picker/RunModelPath/RunModelPath";
import { SkipOnboardingButton } from "@src/components/onboarding-picker/SkipOnboardingButton/SkipOnboardingButton";
import { useServices } from "@src/context/ServicesProvider";

export type OnboardingIntentId = "app" | "tools" | "model";

type OnboardingIntent = {
  id: OnboardingIntentId;
  Icon: LucideIcon;
  title: string;
  description: string;
  isAvailable: boolean;
};

export const ONBOARDING_INTENTS: readonly OnboardingIntent[] = [
  { id: "app", Icon: LayoutTemplate, title: "Deploy an app", description: "Start from a template or your own Docker image.", isAvailable: true },
  { id: "tools", Icon: Terminal, title: "Connect my agent or code", description: "API key, then Claude Code, Cursor, the CLI or REST.", isAvailable: true },
  { id: "model", Icon: Sparkles, title: "Run an AI model", description: "Open models on the GPUs your trial can use now.", isAvailable: true }
];

const QUESTION = "What do you want to do first?";

export const DEPENDENCIES = {
  useRouter,
  useSearchParams,
  useServices,
  useOnboardingApiKey,
  DeploymentTemplatePickerCard,
  ApiKeySetup,
  SkipOnboardingButton,
  RunModelPath
};

type IntentFirstPickerProps = {
  isOutOfCredit: boolean;
  onDeployTemplate: (templateId: string) => void;
  onDeployImage: () => void;
  onRedeemCoupon?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export function IntentFirstPicker({ isOutOfCredit, onDeployTemplate, onDeployImage, onRedeemCoupon, dependencies: d = DEPENDENCIES }: IntentFirstPickerProps) {
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const { urlService, analyticsService } = d.useServices();
  const intents = ONBOARDING_INTENTS.filter(intent => intent.isAvailable);
  const selectedIntent = intents.find(intent => intent.id === searchParams?.get("intent"));
  const onboardingApiKey = d.useOnboardingApiKey({ enabled: selectedIntent?.id === "tools" });
  const footer = <Footer hasApiKey={!!onboardingApiKey.createdApiKey} onRedeemCoupon={onRedeemCoupon} SkipOnboardingButton={d.SkipOnboardingButton} />;

  function selectIntent(intent: OnboardingIntentId, via: "question" | "switch") {
    analyticsService.track("onboarding_intent_selected", { category: "onboarding", intent, via });
    const isRedeemingCoupon = searchParams?.get("redeemCoupon") === "true";
    router.push(urlService.onboardingPicker({ intent, redeemCoupon: isRedeemingCoupon || undefined }), { scroll: false });
  }

  if (!selectedIntent) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[980px]">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{QUESTION}</h1>
          <p className="mt-2 text-[15px] leading-6 text-muted-foreground">Pick one. The others stay one click away.</p>
          <div className="mt-8 grid grid-cols-1 gap-4 min-[820px]:auto-cols-fr min-[820px]:grid-flow-col min-[820px]:grid-cols-none">
            {intents.map(intent => (
              <IntentChoice key={intent.id} intent={intent} onSelect={() => selectIntent(intent.id, "question")} />
            ))}
          </div>
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 pb-14 pt-12">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{QUESTION}</h1>
      <Tabs value={selectedIntent.id} onValueChange={value => selectIntent(value as OnboardingIntentId, "switch")}>
        <TabsList aria-label={QUESTION} className="mt-[18px] flex h-auto flex-wrap gap-2 bg-transparent p-0">
          {intents.map(intent => (
            <IntentTab key={intent.id} intent={intent} />
          ))}
        </TabsList>
        <TabsContent value={selectedIntent.id} className="mt-7">
          <p className="mb-4 text-sm text-muted-foreground">{selectedIntent.description}</p>
          {selectedIntent.id === "app" && (
            <DeployAppPath isOutOfCredit={isOutOfCredit} onDeployTemplate={onDeployTemplate} onDeployImage={onDeployImage} dependencies={d} />
          )}
          {selectedIntent.id === "model" && <d.RunModelPath isOutOfCredit={isOutOfCredit} onDeployTemplate={onDeployTemplate} />}
          {selectedIntent.id === "tools" && (
            <d.ApiKeySetup
              createdApiKey={onboardingApiKey.createdApiKey}
              isCreating={onboardingApiKey.isCreating}
              isLoadingTrialProject={onboardingApiKey.isLoadingTrialProject}
              onCreate={onboardingApiKey.createApiKey}
            />
          )}
        </TabsContent>
      </Tabs>
      {footer}
    </div>
  );
}

function IntentTile({ Icon, className }: { Icon: LucideIcon; className?: string }) {
  return (
    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-muted", className)}>
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

function IntentChoice({ intent, onSelect }: { intent: OnboardingIntent; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col gap-1.5 rounded-[14px] border border-border bg-card p-[22px] text-left text-foreground transition-[border-color,box-shadow] hover:border-foreground hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[820px]:min-h-[200px]"
    >
      <IntentTile Icon={intent.Icon} className="mb-auto" />
      <span className="mt-4 flex items-center justify-between gap-2 text-[17px] font-semibold leading-6 tracking-tight min-[820px]:mt-7">
        {intent.title}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="text-[13.5px] leading-5 text-muted-foreground">{intent.description}</span>
    </button>
  );
}

function IntentTab({ intent }: { intent: OnboardingIntent }) {
  return (
    <TabsTrigger
      value={intent.id}
      className="h-[38px] gap-2 rounded-full border border-border bg-background py-0 pl-3 pr-[15px] text-[13.5px] text-muted-foreground transition-colors data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none hover:text-foreground focus-visible:ring-offset-0"
    >
      <intent.Icon className="h-3.5 w-3.5" />
      {intent.title}
    </TabsTrigger>
  );
}

type DeployAppPathProps = Pick<IntentFirstPickerProps, "isOutOfCredit" | "onDeployTemplate" | "onDeployImage"> & { dependencies: typeof DEPENDENCIES };

function DeployAppPath({ isOutOfCredit, onDeployTemplate, onDeployImage, dependencies: d }: DeployAppPathProps) {
  const { publicConfig, urlService } = d.useServices();
  const cards = pickOnboardingCards(ONBOARDING_SLOTS, trialLimitsFrom(publicConfig));

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {cards.map(({ slot, template }, index) => (
          <d.DeploymentTemplatePickerCard
            key={template.templateId}
            chip={slot.label}
            title={template.name}
            description={template.description}
            priceBold=""
            priceRest={describeTemplateSize(template)}
            ctaLabel={isOutOfCredit ? "Add credits to deploy" : "Deploy now"}
            ctaIcon={isOutOfCredit ? "lock" : "arrow"}
            ctaVariant={index === 0 ? "primary" : "outline"}
            heroImageSrc={template.imageSrc}
            heroImageAlt={`${template.name} template`}
            onDeploy={() => onDeployTemplate(template.templateId)}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card py-2.5 pl-3.5 pr-2.5">
        <IntentTile Icon={Container} className="h-8 w-8 rounded-lg" />
        <p className="min-w-[180px] flex-1 text-sm font-semibold text-foreground">Already have a Docker image?</p>
        <Button variant="outline" className="gap-2 no-underline hover:no-underline" asChild>
          <Link href={urlService.configureDeployment({ exampleImage: true })} onClick={onDeployImage}>
            Deploy image
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </>
  );
}

type FooterProps = {
  hasApiKey: boolean;
  onRedeemCoupon?: () => void;
  SkipOnboardingButton: typeof DEPENDENCIES.SkipOnboardingButton;
};

function Footer({ hasApiKey, onRedeemCoupon, SkipOnboardingButton }: FooterProps) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      {hasApiKey ? <SkipOnboardingButton source="api_key" label="Continue to Console" /> : <SkipOnboardingButton source="picker" label="Skip for now" />}
      {onRedeemCoupon && (
        <>
          <span aria-hidden className="h-1 w-1 rounded-full bg-border" />
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onRedeemCoupon}>
            Have a coupon code?
          </Button>
        </>
      )}
    </div>
  );
}
