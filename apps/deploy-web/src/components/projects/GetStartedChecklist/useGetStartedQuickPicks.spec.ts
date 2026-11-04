import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OnboardingSlot, OnboardingTemplate } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import { ONBOARDING_SLOTS } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import type { BrowserEnvConfig } from "@src/config/browser-env.config";
import { useGetStartedQuickPicks } from "./useGetStartedQuickPicks";

import { setupQuery } from "@tests/unit/query-client";

const GEMMA: OnboardingTemplate = {
  templateId: "gemma-3-4b",
  name: "Gemma 3 4B",
  description: "A small open model.",
  imageSrc: "/gemma.png",
  cpu: 2,
  memoryGi: 4,
  gpu: { vendor: "nvidia", model: "rtx4090" }
};

const GPU_MODEL_SLOT: OnboardingSlot = { id: "gpu-model", label: "Run a model", candidates: [GEMMA] };

describe(useGetStartedQuickPicks.name, () => {
  it("picks Hello world and the trial agent from the onboarding catalog", () => {
    const { result } = setup({});

    expect(result.current).toEqual([
      { templateId: "hello-world", label: "Hello world" },
      { templateId: "akash-network-awesome-akash-Space-Agent", label: "Space Agent" }
    ]);
  });

  it("falls back to an agent that fits a smaller trial", () => {
    const { result } = setup({ maxCpu: 1, maxMemoryGi: 2 });

    expect(result.current.map(quickPick => quickPick.label)).toEqual(["Hello world", "Hermes Agent"]);
  });

  it("labels a GPU model once the catalog offers one", () => {
    const { result } = setup({ slots: [...ONBOARDING_SLOTS, GPU_MODEL_SLOT] });

    expect(result.current).toContainEqual({ templateId: "gemma-3-4b", label: "Gemma 3 4B · GPU" });
  });

  it("leaves out a GPU model the trial blocks", () => {
    const { result } = setup({ slots: [...ONBOARDING_SLOTS, GPU_MODEL_SLOT], blockedGpuModels: ["nvidia/rtx4090"] });

    expect(result.current.map(quickPick => quickPick.templateId)).not.toContain("gemma-3-4b");
  });

  function setup(input: { slots?: readonly OnboardingSlot[]; maxCpu?: number; maxMemoryGi?: number; blockedGpuModels?: string[] }) {
    const publicConfig = mock<BrowserEnvConfig>({
      NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU: input.maxCpu ?? 4,
      NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI: input.maxMemoryGi ?? 16,
      NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: input.blockedGpuModels ?? []
    });

    return setupQuery(() => useGetStartedQuickPicks(input.slots), { services: { publicConfig: () => publicConfig } });
  }
});
