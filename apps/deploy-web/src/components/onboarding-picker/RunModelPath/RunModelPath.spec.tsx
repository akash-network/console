import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { RunnableModel } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import { GPU_MODEL_SLOT } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { AKASHML_ONBOARDING_URL, DEPENDENCIES, RunModelPath } from "./RunModelPath";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

type PickerCardProps = Parameters<typeof DEPENDENCIES.DeploymentTemplatePickerCard>[0];

const [GEMMA, FASTER_WHISPER] = GPU_MODEL_SLOT.candidates;

const NO_FREE_GPU_NOTICE = "None of the GPUs your trial can use are free right now.";

describe(RunModelPath.name, () => {
  it("shows a card per runnable model with its gpu and free units", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({
      models: [
        { template: GEMMA, freeUnits: 8 },
        { template: FASTER_WHISPER, freeUnits: 4 }
      ],
      dependencies: { DeploymentTemplatePickerCard }
    });

    const cards = DeploymentTemplatePickerCard.mock.calls.map(call => call[0] as PickerCardProps);
    expect(cards.map(card => [card.chip, card.title, card.priceRest, card.showLiveDot, card.ctaVariant, card.heroImageAlt])).toEqual([
      ["Chat model", "Gemma 3 4B", "NVIDIA V100 · 8 free", true, "primary", "Gemma 3 4B template"],
      ["Speech to text", "Faster Whisper", "NVIDIA RTX 3060 Ti · 4 free", true, "outline", "Faster Whisper template"]
    ]);
  });

  it("deploys the gpu-pinned template behind a model card", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const { onDeployTemplate } = setup({ models: [{ template: GEMMA, freeUnits: 8 }], dependencies: { DeploymentTemplatePickerCard } });

    act(() => (DeploymentTemplatePickerCard.mock.calls[0][0] as PickerCardProps).onDeploy!());

    expect(onDeployTemplate).toHaveBeenCalledWith("gemma-3-4b-v100");
  });

  it("labels the model cards with the deploy action while the user has credit", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ models: [{ template: GEMMA, freeUnits: 8 }], isOutOfCredit: false, dependencies: { DeploymentTemplatePickerCard } });

    const card = DeploymentTemplatePickerCard.mock.calls[0][0] as PickerCardProps;
    expect([card.ctaLabel, card.ctaIcon]).toEqual(["Deploy now", "arrow"]);
  });

  it("labels the model cards with the add credits action once the user has no credit left", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ models: [{ template: GEMMA, freeUnits: 8 }], isOutOfCredit: true, dependencies: { DeploymentTemplatePickerCard } });

    const card = DeploymentTemplatePickerCard.mock.calls[0][0] as PickerCardProps;
    expect([card.ctaLabel, card.ctaIcon]).toEqual(["Add credits to deploy", "lock"]);
  });

  it("leaves the no free gpu notice off while a model is runnable", () => {
    setup({ models: [{ template: GEMMA, freeUnits: 8 }] });

    expect(screen.queryByText(NO_FREE_GPU_NOTICE)).not.toBeInTheDocument();
  });

  it("tells the user no trial gpu is free once the check finds no runnable model", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ models: [], dependencies: { DeploymentTemplatePickerCard } });

    expect(screen.getByText(NO_FREE_GPU_NOTICE)).toBeInTheDocument();
    expect(DeploymentTemplatePickerCard).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Open AkashML/ })).toBeInTheDocument();
  });

  it("says the check failed instead of claiming no trial gpu is free", () => {
    setup({ models: [], hasCheckFailed: true });

    expect(screen.getByText("We couldn't check which GPUs your trial can use right now.")).toBeInTheDocument();
    expect(screen.queryByText(NO_FREE_GPU_NOTICE)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open AkashML/ })).toBeInTheDocument();
  });

  it("holds the notice back while the gpus are still being checked", () => {
    setup({ models: [], isChecking: true });

    expect(screen.queryByText(NO_FREE_GPU_NOTICE)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Checking which GPUs are free")).toBeInTheDocument();
  });

  it("drops the checking placeholder once the check answers", () => {
    setup({ models: [{ template: GEMMA, freeUnits: 8 }] });

    expect(screen.queryByLabelText("Checking which GPUs are free")).not.toBeInTheDocument();
  });

  it.each([{ models: [{ template: GEMMA, freeUnits: 8 }] }, { models: [] }])("always offers akashml in a new tab (%#)", ({ models }) => {
    setup({ models });

    const link = screen.getByRole("link", { name: /Open AkashML/ });
    expect(link).toHaveAttribute("href", AKASHML_ONBOARDING_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
    expect(screen.getByRole("heading", { name: "Bigger models, no GPU to rent" })).toBeInTheDocument();
  });

  it("tags the akashml link so akashml can attribute sign-ups to console", () => {
    const params = new URL(AKASHML_ONBOARDING_URL).searchParams;

    expect([params.get("utm_source"), params.get("utm_medium"), params.get("utm_campaign")]).toEqual(["akash-console", "onboarding", "trial-onboarding"]);
  });

  it("tracks the akashml click with its onboarding placement", () => {
    const { analyticsService } = setup({ models: [] });

    fireEvent.click(screen.getByRole("link", { name: /Open AkashML/ }));

    expect(analyticsService.track).toHaveBeenCalledWith("akashml_link_click", { category: "onboarding", placement: "onboarding_model" });
  });

  function setup(input: {
    models: RunnableModel[];
    isChecking?: boolean;
    hasCheckFailed?: boolean;
    isOutOfCredit?: boolean;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const onDeployTemplate = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });
    const useTrialRunnableModels: typeof DEPENDENCIES.useTrialRunnableModels = () => ({
      models: input.models,
      isChecking: input.isChecking ?? false,
      hasCheckFailed: input.hasCheckFailed ?? false
    });

    render(
      <RunModelPath
        isOutOfCredit={input.isOutOfCredit ?? false}
        onDeployTemplate={onDeployTemplate}
        dependencies={MockComponents(DEPENDENCIES, { useServices, useTrialRunnableModels, ...input.dependencies })}
      />
    );

    return { onDeployTemplate, analyticsService };
  }
});
