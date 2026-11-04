import type { TrialResourceLimit } from "@src/components/deployments/ConfigureDeployment/ConfigurationPane/HardwareSection/trialResourceLimit/trialResourceLimit";
import { exceedsTrialResourceLimit } from "@src/components/deployments/ConfigureDeployment/ConfigurationPane/HardwareSection/trialResourceLimit/trialResourceLimit";
import { isTrialBlockedGpuModel } from "@src/utils/deploymentData/v1beta3";

export type OnboardingSlotId = "quick-start" | "agent" | "gpu-model";

export type OnboardingTemplate = {
  templateId: string;
  name: string;
  description: string;
  imageSrc: string;
  cpu: number;
  memoryGi: number;
  gpu?: { vendor: string; model: string };
};

export type OnboardingSlot = {
  id: OnboardingSlotId;
  label: string;
  candidates: readonly OnboardingTemplate[];
};

export type OnboardingCard = { slot: OnboardingSlot; template: OnboardingTemplate };

export type TrialLimits = TrialResourceLimit & { blockedGpuModels: readonly string[] };

const MIB_PER_GIB = 1024;

const AGENT_IMAGE_SRC = "/images/onboarding/stable-diffusion.png";

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

/** Hand-picked on purpose: sourcing from the full gallery would let mining templates, which fit the trial limits, onto the page. */
export const ONBOARDING_SLOTS: readonly OnboardingSlot[] = [
  { id: "quick-start", label: "Quick start", candidates: [HELLO_WORLD] },
  { id: "agent", label: "Picked for your trial", candidates: [SPACE_AGENT, OPENCLAW, HERMES_AGENT] }
];

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
