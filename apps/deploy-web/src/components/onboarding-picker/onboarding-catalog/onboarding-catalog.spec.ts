import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { hardcodedTemplates } from "@src/utils/templates";
import type { OnboardingModelTemplate, OnboardingSlot, OnboardingTemplate, TrialLimits } from "./onboarding-catalog";
import {
  describeModelGpu,
  describeTemplateSize,
  fitsTrialLimits,
  GPU_MODEL_SLOT,
  ONBOARDING_SLOTS,
  pickOnboardingCards,
  pickRunnableModels,
  trialLimitsFrom
} from "./onboarding-catalog";

type ComputeProfile = {
  resources: {
    cpu: { units: number };
    memory: { size: string };
    gpu: { units: number; attributes: { vendor: Record<string, { model: string }[]> } };
  };
};

const TRIAL_LIMITS: TrialLimits = { maxCpu: 4, maxMemoryGi: 16, blockedGpuModels: ["nvidia/h100"] };

describe("onboarding catalog", () => {
  describe(fitsTrialLimits.name, () => {
    it("accepts a template within the cpu and memory limits", () => {
      expect(fitsTrialLimits(buildTemplate({ cpu: 4, memoryGi: 16 }), TRIAL_LIMITS)).toBe(true);
    });

    it("rejects a template over the cpu limit", () => {
      expect(fitsTrialLimits(buildTemplate({ cpu: 4.5 }), TRIAL_LIMITS)).toBe(false);
    });

    it("rejects a template over the memory limit", () => {
      expect(fitsTrialLimits(buildTemplate({ memoryGi: 17 }), TRIAL_LIMITS)).toBe(false);
    });

    it("rejects a template that needs a gpu model blocked on trial", () => {
      expect(fitsTrialLimits(buildTemplate({ gpu: { vendor: "nvidia", model: "h100", label: "NVIDIA H100" } }), TRIAL_LIMITS)).toBe(false);
    });

    it("accepts a template that needs a gpu model allowed on trial", () => {
      expect(fitsTrialLimits(buildTemplate({ gpu: { vendor: "nvidia", model: "v100", label: "NVIDIA V100" } }), TRIAL_LIMITS)).toBe(true);
    });
  });

  describe(pickOnboardingCards.name, () => {
    it("picks the first candidate per slot that fits the trial limits", () => {
      const tooBig = buildTemplate({ templateId: "too-big", cpu: 8 });
      const fits = buildTemplate({ templateId: "fits" });
      const alsoFits = buildTemplate({ templateId: "also-fits" });
      const slot = buildSlot({ candidates: [tooBig, fits, alsoFits] });

      expect(pickOnboardingCards([slot], TRIAL_LIMITS)).toEqual([{ slot, template: fits }]);
    });

    it("leaves out a slot when none of its candidates fit", () => {
      const quickStart = buildSlot({ id: "quick-start", candidates: [buildTemplate({ templateId: "small" })] });
      const gpuModel = buildSlot({ id: "gpu-model", candidates: [buildTemplate({ gpu: { vendor: "nvidia", model: "h100", label: "NVIDIA H100" } })] });

      const cards = pickOnboardingCards([quickStart, gpuModel], TRIAL_LIMITS);

      expect(cards.map(card => card.slot.id)).toEqual(["quick-start"]);
    });

    it("offers hello world and space agent on the default trial limits", () => {
      const cards = pickOnboardingCards(ONBOARDING_SLOTS, TRIAL_LIMITS);

      expect(cards.map(card => card.template.templateId)).toEqual(["hello-world", "akash-network-awesome-akash-Space-Agent"]);
    });

    it("falls back to the next agent when space agent doesn't fit", () => {
      const cards = pickOnboardingCards(ONBOARDING_SLOTS, { ...TRIAL_LIMITS, maxCpu: 3 });

      expect(cards.map(card => card.template.name)).toEqual(["Hello world", "OpenClaw"]);
    });

    it("falls back to hermes agent when only it fits", () => {
      const cards = pickOnboardingCards(ONBOARDING_SLOTS, { ...TRIAL_LIMITS, maxCpu: 2 });

      expect(cards.map(card => card.template.name)).toEqual(["Hello world", "Hermes Agent"]);
    });
  });

  describe(pickRunnableModels.name, () => {
    it("offers every model whose gpu has free units", () => {
      const models = pickRunnableModels(
        [
          { vendor: "nvidia", model: "v100", freeUnits: 8 },
          { vendor: "nvidia", model: "rtx3060ti", freeUnits: 4 }
        ],
        TRIAL_LIMITS
      );

      expect(models.map(({ template, freeUnits }) => [template.name, freeUnits])).toEqual([
        ["Gemma 3 4B", 8],
        ["Faster Whisper", 4]
      ]);
    });

    it("leaves out a model whose gpu isn't in the free list", () => {
      const models = pickRunnableModels([{ vendor: "nvidia", model: "rtx3060ti", freeUnits: 4 }], TRIAL_LIMITS);

      expect(models.map(model => model.template.name)).toEqual(["Faster Whisper"]);
    });

    it("leaves out a model whose gpu reports no free units", () => {
      const models = pickRunnableModels([{ vendor: "nvidia", model: "v100", freeUnits: 0 }], TRIAL_LIMITS);

      expect(models).toEqual([]);
    });

    it("matches the gpu on vendor as well as model", () => {
      const models = pickRunnableModels([{ vendor: "amd", model: "v100", freeUnits: 8 }], TRIAL_LIMITS);

      expect(models).toEqual([]);
    });

    it("offers nothing when no gpu is free", () => {
      expect(pickRunnableModels([], TRIAL_LIMITS)).toEqual([]);
    });

    it("leaves out a model that doesn't fit the trial limits even when its gpu is free", () => {
      const small = buildModelTemplate({ name: "Small", memoryGi: 4 });
      const large = buildModelTemplate({ name: "Large", memoryGi: 16 });

      const models = pickRunnableModels([{ vendor: "nvidia", model: "v100", freeUnits: 8 }], { ...TRIAL_LIMITS, maxMemoryGi: 8 }, [small, large]);

      expect(models.map(model => model.template.name)).toEqual(["Small"]);
    });

    it("leaves out a model whose gpu is blocked on trial", () => {
      const models = pickRunnableModels([{ vendor: "nvidia", model: "v100", freeUnits: 8 }], { ...TRIAL_LIMITS, blockedGpuModels: ["nvidia/v100"] });

      expect(models).toEqual([]);
    });

    it("picks from the candidates it is given", () => {
      const candidate = buildModelTemplate({ gpu: { vendor: "nvidia", model: "t4", label: "NVIDIA T4" } });

      const models = pickRunnableModels([{ vendor: "nvidia", model: "t4", freeUnits: 1 }], TRIAL_LIMITS, [candidate]);

      expect(models).toEqual([{ template: candidate, freeUnits: 1 }]);
    });
  });

  describe(describeModelGpu.name, () => {
    it("shows the gpu and how many units are free", () => {
      const template = buildModelTemplate({ gpu: { vendor: "nvidia", model: "v100", label: "NVIDIA V100" } });

      expect(describeModelGpu({ template, freeUnits: 8 })).toBe("NVIDIA V100 · 8 free");
    });
  });

  describe(trialLimitsFrom.name, () => {
    it("reads the trial limits from the public config", () => {
      const limits = trialLimitsFrom({
        NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU: 4,
        NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI: 16,
        NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: ["nvidia/h100"]
      });

      expect(limits).toEqual({ maxCpu: 4, maxMemoryGi: 16, blockedGpuModels: ["nvidia/h100"] });
    });
  });

  describe("gpu model slot", () => {
    it.each(GPU_MODEL_SLOT.candidates.map(template => [template.name, template] as const))(
      "deploys %s from a hardcoded sdl that requests the size and the single gpu model the card shows",
      (_name, template) => {
        const sdl = hardcodedTemplates.find(hardcoded => hardcoded.code === template.templateId)!;
        const profiles = Object.values((yaml.load(sdl.content) as { profiles: { compute: Record<string, ComputeProfile> } }).profiles.compute);

        expect(profiles.map(({ resources }) => [resources.cpu.units, resources.memory.size, resources.gpu.units, resources.gpu.attributes.vendor])).toEqual([
          [template.cpu, `${template.memoryGi}Gi`, 1, { [template.gpu.vendor]: [{ model: template.gpu.model }] }]
        ]);
      }
    );

    it("fits every model on the default trial limits", () => {
      expect(GPU_MODEL_SLOT.candidates.every(template => fitsTrialLimits(template, TRIAL_LIMITS))).toBe(true);
    });
  });

  describe(describeTemplateSize.name, () => {
    it("shows memory under one gibibyte in mebibytes", () => {
      expect(describeTemplateSize(buildTemplate({ cpu: 0.5, memoryGi: 0.5 }))).toBe("0.5 vCPU · 512 MiB");
    });

    it("shows memory of one gibibyte or more in gibibytes", () => {
      expect(describeTemplateSize(buildTemplate({ cpu: 1, memoryGi: 1 }))).toBe("1 vCPU · 1 GiB");
    });
  });

  function buildTemplate(overrides: Partial<OnboardingTemplate> = {}): OnboardingTemplate {
    return {
      templateId: "template",
      name: "Template",
      description: "A template.",
      imageSrc: "/template.png",
      cpu: 1,
      memoryGi: 1,
      ...overrides
    };
  }

  function buildModelTemplate(overrides: Partial<OnboardingModelTemplate> = {}): OnboardingModelTemplate {
    return {
      ...buildTemplate(),
      kind: "Chat model",
      gpu: { vendor: "nvidia", model: "v100", label: "NVIDIA V100" },
      ...overrides
    };
  }

  function buildSlot(overrides: Partial<OnboardingSlot> = {}): OnboardingSlot {
    return { id: "agent", label: "Agent", candidates: [], ...overrides };
  }
});
