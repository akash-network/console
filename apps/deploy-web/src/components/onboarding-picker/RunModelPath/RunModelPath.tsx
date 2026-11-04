"use client";

import { Button, Skeleton } from "@akashnetwork/ui/components";
import { ExternalLink, Info } from "lucide-react";

import { DeploymentTemplatePickerCard } from "@src/components/deployments/DeploymentTemplatePickerCard/DeploymentTemplatePickerCard";
import { describeModelGpu } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import { useTrialRunnableModels } from "@src/components/onboarding-picker/onboarding-catalog/useTrialRunnableModels";
import { useServices } from "@src/context/ServicesProvider";

export const AKASHML_ONBOARDING_URL = "https://playground.akashml.com?utm_source=akash-console&utm_medium=onboarding&utm_campaign=trial-onboarding";

const AKASHML_MODELS = ["Llama 3.3 70B", "Qwen", "GPT OSS 120B"];

export const DEPENDENCIES = {
  useServices,
  useTrialRunnableModels,
  DeploymentTemplatePickerCard
};

type RunModelPathProps = {
  isOutOfCredit: boolean;
  onDeployTemplate: (templateId: string) => void;
  dependencies?: typeof DEPENDENCIES;
};

export function RunModelPath({ isOutOfCredit, onDeployTemplate, dependencies: d = DEPENDENCIES }: RunModelPathProps) {
  const { analyticsService } = d.useServices();
  const { models, isChecking } = d.useTrialRunnableModels();
  const hasNoRunnableModel = !isChecking && models.length === 0;

  function trackAkashMlClick() {
    analyticsService.track("akashml_link_click", { category: "onboarding", placement: "onboarding_model" });
  }

  return (
    <>
      {hasNoRunnableModel && (
        <p className="mb-4 flex items-start gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5 text-[13px] leading-5 text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          None of the GPUs your trial can use are free right now.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {isChecking && <Skeleton aria-label="Checking which GPUs are free" className="min-h-[340px] rounded-xl" />}
        {models.map((model, index) => (
          <d.DeploymentTemplatePickerCard
            key={model.template.templateId}
            chip={model.template.kind}
            title={model.template.name}
            description={model.template.description}
            priceBold=""
            priceRest={describeModelGpu(model)}
            showLiveDot
            ctaLabel={isOutOfCredit ? "Add credits to deploy" : "Deploy now"}
            ctaIcon={isOutOfCredit ? "lock" : "arrow"}
            ctaVariant={index === 0 ? "primary" : "outline"}
            heroImageSrc={model.template.imageSrc}
            heroImageAlt={`${model.template.name} template`}
            onDeploy={() => onDeployTemplate(model.template.templateId)}
          />
        ))}
        <AkashMlCard onOpen={trackAkashMlClick} />
      </div>
    </>
  );
}

function AkashMlCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-col rounded-xl">
      <div className="flex h-40 flex-wrap content-center items-center justify-center gap-2 rounded-t-xl border border-b-0 border-border bg-muted px-6">
        {AKASHML_MODELS.map(model => (
          <span key={model} className="rounded-full border border-border bg-background px-3 py-1 font-mono text-xs text-foreground">
            {model}
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 rounded-b-xl border border-border bg-card p-4">
        <div className="self-start">
          <span className="inline-flex items-center rounded-md border border-input bg-background px-2 py-0.5 text-[11px] leading-4 text-muted-foreground">
            AkashML
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl leading-8 text-card-foreground">Bigger models, no GPU to rent</h3>
          <p className="min-h-10 text-sm leading-5 text-muted-foreground">
            Llama 3.3 70B, Qwen and GPT OSS 120B as a hosted API, so there&apos;s nothing to deploy.
          </p>
        </div>
        <p className="font-mono text-xs leading-5 text-muted-foreground">Pay per token</p>
        <Button variant="outline" className="mt-auto w-full gap-2" asChild>
          <a href={AKASHML_ONBOARDING_URL} target="_blank" rel="noopener" onClick={onOpen}>
            Open AkashML
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
