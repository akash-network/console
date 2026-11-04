import { describe, expect, it } from "vitest";

import type { OnboardingSlot, OnboardingTemplate, TrialLimits } from "./onboarding-catalog";
import { describeTemplateSize, fitsTrialLimits, ONBOARDING_SLOTS, pickOnboardingCards } from "./onboarding-catalog";

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
      expect(fitsTrialLimits(buildTemplate({ gpu: { vendor: "nvidia", model: "h100" } }), TRIAL_LIMITS)).toBe(false);
    });

    it("accepts a template that needs a gpu model allowed on trial", () => {
      expect(fitsTrialLimits(buildTemplate({ gpu: { vendor: "nvidia", model: "v100" } }), TRIAL_LIMITS)).toBe(true);
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
      const gpuModel = buildSlot({ id: "gpu-model", candidates: [buildTemplate({ gpu: { vendor: "nvidia", model: "h100" } })] });

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

  function buildSlot(overrides: Partial<OnboardingSlot> = {}): OnboardingSlot {
    return { id: "agent", label: "Agent", candidates: [], ...overrides };
  }
});
