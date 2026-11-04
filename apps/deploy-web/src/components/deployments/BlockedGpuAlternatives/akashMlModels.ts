export type BlockedGpuPlacement = "configure" | "template_detail";

export type AkashMlModel = { name: string; path: string };

type AkashMlFamily = AkashMlModel & { templateModelPattern: RegExp };

const AKASHML_BASE_URL = "https://akashml.com";

const AKASHML_MODELS_PATH = "/models";

const GALLERY_TEMPLATE_ID_PREFIX = /^akash-network-awesome-akash-/i;

/** Matched on the model a gallery template runs, and only where AkashML hosts the same family, so a distill or vision variant never points at a different model. */
const AKASHML_FAMILIES: readonly AkashMlFamily[] = [
  { name: "Llama 3.3 70B", path: "/models/llama-3-3-70b", templateModelPattern: /^llama-?[234](?!.*vision)/i },
  { name: "GPT OSS 120B", path: "/models/gpt-oss-120b", templateModelPattern: /^(openai-)?gpt-oss/i },
  { name: "Kimi K3", path: "/models/kimi-k3", templateModelPattern: /^kimi/i },
  { name: "Qwen", path: AKASHML_MODELS_PATH, templateModelPattern: /^(qwen|qwq)/i }
];

export function findAkashMlModel(templateId: string | undefined): AkashMlModel | undefined {
  if (!templateId) return undefined;
  const templateModel = templateId.replace(GALLERY_TEMPLATE_ID_PREFIX, "");
  const family = AKASHML_FAMILIES.find(({ templateModelPattern }) => templateModelPattern.test(templateModel));
  return family && { name: family.name, path: family.path };
}

export function buildAkashMlUrl(model: AkashMlModel, placement: BlockedGpuPlacement): string {
  const url = new URL(model.path, AKASHML_BASE_URL);
  url.searchParams.set("utm_source", "akash-console");
  url.searchParams.set("utm_medium", placement);
  url.searchParams.set("utm_campaign", "trial-gpu-block");
  return url.toString();
}
