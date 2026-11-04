import type { TrialResourceLimit } from "@src/components/deployments/ConfigureDeployment/ConfigurationPane/HardwareSection/trialResourceLimit/trialResourceLimit";
import { exceedsTrialResourceLimit } from "@src/components/deployments/ConfigureDeployment/ConfigurationPane/HardwareSection/trialResourceLimit/trialResourceLimit";
import type { BrowserEnvConfig } from "@src/config/browser-env.config";
import type { TrialGpuAvailability } from "@src/types/gpu";
import { isTrialBlockedGpuModel } from "@src/utils/deploymentData/v1beta3";
import { fasterWhisperTrialTemplate, gemmaTrialTemplate } from "@src/utils/templates";

export type OnboardingSlotId = "quick-start" | "agent" | "gpu-model";

export type OnboardingGpu = { vendor: string; model: string; label: string };

export type OnboardingTemplate = {
  templateId: string;
  name: string;
  description: string;
  imageSrc: string;
  cpu: number;
  memoryGi: number;
  gpu?: OnboardingGpu;
};

export type OnboardingModelTemplate = OnboardingTemplate & { kind: string; gpu: OnboardingGpu };

export type OnboardingSlot<Template extends OnboardingTemplate = OnboardingTemplate> = {
  id: OnboardingSlotId;
  label: string;
  candidates: readonly Template[];
};

export type RunnableModel = { template: OnboardingModelTemplate; freeUnits: number };

export type OnboardingCard = { slot: OnboardingSlot; template: OnboardingTemplate };

export type TrialLimits = TrialResourceLimit & { blockedGpuModels: readonly string[] };

const MIB_PER_GIB = 1024;

const AGENT_IMAGE_SRC = "/images/onboarding/stable-diffusion.png";

const MODEL_IMAGE_SRC = "/images/onboarding/llm-chatbot.png";

const HELLO_WORLD: OnboardingTemplate = {
  templateId: "hello-world",
  name: "Hello world",
  description: "A web page live in about a minute.",
  imageSrc: "/images/onboarding/hello-world.png",
  cpu: 0.5,
  memoryGi: 0.5
};

const SPACE_AGENT: OnboardingTemplate = {
  templateId: "akash-network-awesome-akash-Space-Agent",
  name: "Space Agent",
  description: "Your own AI agent workspace to talk to.",
  imageSrc: AGENT_IMAGE_SRC,
  cpu: 4,
  memoryGi: 8
};

const OPENCLAW: OnboardingTemplate = {
  templateId: "akash-network-awesome-akash-openclaw",
  name: "OpenClaw",
  description: "An open-source AI assistant you run yourself. No GPU needed.",
  imageSrc: AGENT_IMAGE_SRC,
  cpu: 3,
  memoryGi: 6
};

const HERMES_AGENT: OnboardingTemplate = {
  templateId: "akash-network-awesome-akash-Hermes-Agent",
  name: "Hermes Agent",
  description: "An open-source agent that keeps learning as you use it.",
  imageSrc: AGENT_IMAGE_SRC,
  cpu: 1,
  memoryGi: 2
};

const GEMMA_3_4B: OnboardingModelTemplate = {
  templateId: gemmaTrialTemplate.code,
  name: "Gemma 3 4B",
  kind: "Chat model",
  description: "Chat with Google's open model through the Ollama API.",
  imageSrc: MODEL_IMAGE_SRC,
  cpu: 4,
  memoryGi: 16,
  gpu: { vendor: "nvidia", model: "v100", label: "NVIDIA V100" }
};

const FASTER_WHISPER: OnboardingModelTemplate = {
  templateId: fasterWhisperTrialTemplate.code,
  name: "Faster Whisper",
  kind: "Speech to text",
  description: "Upload a recording and get the text back.",
  imageSrc: MODEL_IMAGE_SRC,
  cpu: 4,
  memoryGi: 16,
  gpu: { vendor: "nvidia", model: "rtx3060ti", label: "NVIDIA RTX 3060 Ti" }
};

/** Hand-picked on purpose: sourcing from the full gallery would let mining templates, which fit the trial limits, onto the page. */
export const ONBOARDING_SLOTS: readonly OnboardingSlot[] = [
  { id: "quick-start", label: "Quick start", candidates: [HELLO_WORLD] },
  { id: "agent", label: "Picked for your trial", candidates: [SPACE_AGENT, OPENCLAW, HERMES_AGENT] }
];

/** Kept out of ONBOARDING_SLOTS because a model card also needs free units on its GPU, which pickOnboardingCards doesn't check. */
export const GPU_MODEL_SLOT: OnboardingSlot<OnboardingModelTemplate> = {
  id: "gpu-model",
  label: "GPU available now",
  candidates: [GEMMA_3_4B, FASTER_WHISPER]
};

export function trialLimitsFrom(
  config: Pick<
    BrowserEnvConfig,
    "NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU" | "NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI" | "NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS"
  >
): TrialLimits {
  return {
    maxCpu: config.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU,
    maxMemoryGi: config.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI,
    blockedGpuModels: config.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS
  };
}

export function fitsTrialLimits(template: OnboardingTemplate, limits: TrialLimits): boolean {
  const fitsSize = !exceedsTrialResourceLimit({ cpu: template.cpu, memoryGi: template.memoryGi }, limits);
  const isGpuAllowed = !template.gpu || !isTrialBlockedGpuModel(template.gpu.vendor, template.gpu.model, limits.blockedGpuModels);
  return fitsSize && isGpuAllowed;
}

export function pickOnboardingCards(slots: readonly OnboardingSlot[], limits: TrialLimits): OnboardingCard[] {
  return slots.flatMap(slot => {
    const template = slot.candidates.find(candidate => fitsTrialLimits(candidate, limits));
    return template ? [{ slot, template }] : [];
  });
}

export function describeTemplateSize(template: OnboardingTemplate): string {
  const memory = template.memoryGi < 1 ? `${template.memoryGi * MIB_PER_GIB} MiB` : `${template.memoryGi} GiB`;
  return `${template.cpu} vCPU · ${memory}`;
}

export function pickRunnableModels(
  availability: readonly TrialGpuAvailability[],
  limits: TrialLimits,
  candidates: readonly OnboardingModelTemplate[] = GPU_MODEL_SLOT.candidates
): RunnableModel[] {
  return candidates.flatMap(template => {
    const freeUnits = countFreeUnits(template.gpu, availability);
    return freeUnits > 0 && fitsTrialLimits(template, limits) ? [{ template, freeUnits }] : [];
  });
}

export function describeModelGpu({ template, freeUnits }: RunnableModel): string {
  return `${template.gpu.label} · ${freeUnits} free`;
}

function countFreeUnits(gpu: OnboardingGpu, availability: readonly TrialGpuAvailability[]): number {
  return availability.find(entry => entry.vendor === gpu.vendor && entry.model === gpu.model)?.freeUnits ?? 0;
}
