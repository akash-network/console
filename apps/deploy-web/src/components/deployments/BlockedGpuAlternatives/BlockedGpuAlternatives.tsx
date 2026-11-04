"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { Button } from "@akashnetwork/ui/components";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

import type { RunnableModel } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import { describeModelGpu } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import { useTrialRunnableModels } from "@src/components/onboarding-picker/onboarding-catalog/useTrialRunnableModels";
import { useServices } from "@src/context/ServicesProvider";
import { useAddCredits } from "@src/hooks/useAddCredits";
import { useIsOutOfDeployCredit } from "@src/hooks/useIsOutOfDeployCredit/useIsOutOfDeployCredit";
import type { AkashMlModel, BlockedGpuPlacement } from "./akashMlModels";
import { buildAkashMlUrl, findAkashMlModel } from "./akashMlModels";

export const DEPENDENCIES = {
  useServices,
  useRouter,
  useAddCredits,
  useIsOutOfDeployCredit,
  useTrialRunnableModels
};

type AlternativeOption = "akashml" | "smaller_model" | "add_credits";

type Alternative = { option: AlternativeOption; title: string; description: string; renderAction: (isPrimary: boolean) => ReactNode };

const ADD_CREDITS_DESCRIPTION = "Add credits to rent high-end GPUs, along with longer runtimes and the full Console.";

type Props = {
  templateId?: string;
  placement: BlockedGpuPlacement;
  dependencies?: typeof DEPENDENCIES;
};

export function BlockedGpuAlternatives({ templateId, placement, dependencies: d = DEPENDENCIES }: Props) {
  const headingId = useId();
  const { analyticsService, urlService } = d.useServices();
  const router = d.useRouter();
  const openAddCredits = d.useAddCredits();
  const isOutOfCredit = d.useIsOutOfDeployCredit();
  const { models } = d.useTrialRunnableModels();
  const akashMlModel = findAkashMlModel(templateId);
  const smallerModel = isOutOfCredit ? undefined : models[0];

  function trackAlternativeClick(option: AlternativeOption) {
    analyticsService.track("trial_gpu_alternative_click", { category: "onboarding", option, placement, templateId });
  }

  function openAkashMl() {
    trackAlternativeClick("akashml");
    analyticsService.track("akashml_link_click", { category: "onboarding", placement, templateId });
  }

  function deploySmallerModel(model: RunnableModel) {
    trackAlternativeClick("smaller_model");
    analyticsService.flush();
    router.push(urlService.configureDeployment({ templateId: model.template.templateId, sdlStrategy: "default", bidStrategy: "auto" }));
  }

  function addCredits() {
    trackAlternativeClick("add_credits");
    openAddCredits({ initialTab: "purchase", description: ADD_CREDITS_DESCRIPTION, context: "trial_gpu_block", suggestFirstDeployment: false });
  }

  const alternatives: Alternative[] = [
    ...(akashMlModel ? [describeAkashMlAlternative(akashMlModel, buildAkashMlUrl(akashMlModel, placement), openAkashMl)] : []),
    ...(smallerModel ? [describeSmallerModelAlternative(smallerModel, () => deploySmallerModel(smallerModel))] : []),
    {
      option: "add_credits",
      title: "Add credits",
      description: "Rent this GPU and get longer runtimes.",
      renderAction: isPrimary => (
        <Button type="button" size="sm" variant={isPrimary ? "default" : "outline"} onClick={addCredits}>
          Add credits
        </Button>
      )
    }
  ];

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="text-sm font-semibold text-card-foreground">
          Your free trial can&apos;t use this GPU
        </h3>
        <p className="text-xs leading-5 text-muted-foreground">Here are your other options.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {alternatives.map((alternative, index) => (
          <li key={alternative.option} className="flex flex-col items-start gap-2 rounded-md border border-border bg-background p-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">{alternative.title}</p>
              <p className="text-xs leading-5 text-muted-foreground">{alternative.description}</p>
            </div>
            {alternative.renderAction(index === 0)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function describeAkashMlAlternative(model: AkashMlModel, href: string, onOpen: () => void): Alternative {
  return {
    option: "akashml",
    title: `Run ${model.name} on AkashML`,
    description: "The same model family as a hosted API. You pay per token, with no GPU to rent.",
    renderAction: isPrimary => (
      <Button size="sm" variant={isPrimary ? "default" : "outline"} className="gap-2" asChild>
        <a href={href} target="_blank" rel="noopener" onClick={onOpen}>
          Open AkashML
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    )
  };
}

function describeSmallerModelAlternative(model: RunnableModel, onDeploy: () => void): Alternative {
  return {
    option: "smaller_model",
    title: "Try a smaller model",
    description: `${model.template.name} fits your trial. ${describeModelGpu(model)} right now.`,
    renderAction: isPrimary => (
      <Button type="button" size="sm" variant={isPrimary ? "default" : "outline"} onClick={onDeploy}>
        Deploy {model.template.name}
      </Button>
    )
  };
}
