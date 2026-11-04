import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { RunnableModel } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import { GPU_MODEL_SLOT } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { UrlService } from "@src/utils/urlUtils";
import { BlockedGpuAlternatives, DEPENDENCIES } from "./BlockedGpuAlternatives";

import { fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

const LLAMA_70B_TEMPLATE_ID = "akash-network-awesome-akash-Llama-3.3-70B";

const COMFYUI_TEMPLATE_ID = "akash-network-awesome-akash-comfyui";

const [GEMMA, FASTER_WHISPER] = GPU_MODEL_SLOT.candidates;

const RUNNABLE_MODELS: RunnableModel[] = [
  { template: GEMMA, freeUnits: 8 },
  { template: FASTER_WHISPER, freeUnits: 2 }
];

describe(BlockedGpuAlternatives.name, () => {
  it("offers AkashML first, then a smaller model, then credits for an LLM template AkashML hosts", () => {
    setup({ templateId: LLAMA_70B_TEMPLATE_ID, models: RUNNABLE_MODELS });

    expect(listOptionTitles()).toEqual(["Run Llama 3.3 70B on AkashML", "Try a smaller model", "Add credits"]);
    expect(screen.getByRole("link", { name: /Open AkashML/ })).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: "Deploy Gemma 3 4B" })).not.toHaveClass("bg-primary");
    expect(screen.getByText("Gemma 3 4B fits your trial. NVIDIA V100 · 8 free right now.")).toBeInTheDocument();
  });

  it("offers a smaller model first, then credits, for a template AkashML has no equivalent for", () => {
    setup({ templateId: COMFYUI_TEMPLATE_ID, models: RUNNABLE_MODELS });

    expect(listOptionTitles()).toEqual(["Try a smaller model", "Add credits"]);
    expect(screen.queryByRole("link", { name: /Open AkashML/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deploy Gemma 3 4B" })).toHaveClass("bg-primary");
  });

  it("leaves the smaller model out while no trial gpu is free", () => {
    setup({ templateId: LLAMA_70B_TEMPLATE_ID, models: [] });

    expect(listOptionTitles()).toEqual(["Run Llama 3.3 70B on AkashML", "Add credits"]);
  });

  it("leaves the smaller model out once the trial has no credit left to deploy it", () => {
    setup({ templateId: LLAMA_70B_TEMPLATE_ID, models: RUNNABLE_MODELS, isOutOfCredit: true });

    expect(listOptionTitles()).toEqual(["Run Llama 3.3 70B on AkashML", "Add credits"]);
  });

  it("makes credits the main action when nothing else fits", () => {
    setup({ templateId: COMFYUI_TEMPLATE_ID, models: [] });

    expect(listOptionTitles()).toEqual(["Add credits"]);
    expect(screen.getByRole("button", { name: "Add credits" })).toHaveClass("bg-primary");
  });

  it("opens the matching AkashML model in a new tab, tagged with the placement", () => {
    setup({ templateId: LLAMA_70B_TEMPLATE_ID, models: [], placement: "template_detail" });

    const link = screen.getByRole("link", { name: /Open AkashML/ });
    expect(link).toHaveAttribute(
      "href",
      "https://akashml.com/models/llama-3-3-70b?utm_source=akash-console&utm_medium=template_detail&utm_campaign=trial-gpu-block"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
  });

  it("tracks the AkashML click as both an AkashML link click and a trial gpu alternative", () => {
    const { analyticsService } = setup({ templateId: LLAMA_70B_TEMPLATE_ID, models: [] });

    fireEvent.click(screen.getByRole("link", { name: /Open AkashML/ }));

    expect(analyticsService.track.mock.calls).toEqual([
      ["trial_gpu_alternative_click", { category: "onboarding", option: "akashml", placement: "configure", templateId: LLAMA_70B_TEMPLATE_ID }],
      ["akashml_link_click", { category: "onboarding", placement: "configure", templateId: LLAMA_70B_TEMPLATE_ID }]
    ]);
  });

  it("deploys the smaller model in one click through the auto deploy flow", () => {
    const { analyticsService, push } = setup({ templateId: COMFYUI_TEMPLATE_ID, models: RUNNABLE_MODELS });

    fireEvent.click(screen.getByRole("button", { name: "Deploy Gemma 3 4B" }));

    expect(analyticsService.track).toHaveBeenCalledWith("trial_gpu_alternative_click", {
      category: "onboarding",
      option: "smaller_model",
      placement: "configure",
      templateId: COMFYUI_TEMPLATE_ID
    });
    expect(analyticsService.flush).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/new-deployment/configure?templateId=gemma-3-4b-v100&sdl-strategy=default&bid-strategy=auto");
  });

  it("opens the add credits sheet for the gpu block", () => {
    const { analyticsService, openAddCredits } = setup({ templateId: COMFYUI_TEMPLATE_ID, models: [] });

    fireEvent.click(screen.getByRole("button", { name: "Add credits" }));

    expect(analyticsService.track).toHaveBeenCalledWith("trial_gpu_alternative_click", {
      category: "onboarding",
      option: "add_credits",
      placement: "configure",
      templateId: COMFYUI_TEMPLATE_ID
    });
    expect(openAddCredits).toHaveBeenCalledWith({
      initialTab: "purchase",
      description: "Add credits to rent high-end GPUs, along with longer runtimes and the full Console.",
      context: "trial_gpu_block",
      suggestFirstDeployment: false
    });
  });

  function listOptionTitles() {
    return screen.getAllByRole("listitem").map(item => item.querySelector("p")?.textContent);
  }

  function setup(input: { templateId?: string; models: RunnableModel[]; isOutOfCredit?: boolean; placement?: "configure" | "template_detail" }) {
    const analyticsService = mock<AnalyticsService>();
    const push = vi.fn();
    const openAddCredits = vi.fn();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService, urlService: UrlService });
    const useRouter: typeof DEPENDENCIES.useRouter = () => mock<AppRouterInstance>({ push });

    render(
      <BlockedGpuAlternatives
        templateId={input.templateId}
        placement={input.placement ?? "configure"}
        dependencies={MockComponents(DEPENDENCIES, {
          useServices,
          useRouter,
          useAddCredits: () => openAddCredits,
          useIsOutOfDeployCredit: () => input.isOutOfCredit ?? false,
          useTrialRunnableModels: () => ({ models: input.models, isChecking: false, hasCheckFailed: false })
        })}
      />
    );

    return { analyticsService, push, openAddCredits };
  }
});
