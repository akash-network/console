import type { Manifest as AkashManifest, SDLInput } from "@akashnetwork/chain-sdk/web";
import { generateManifest, generateManifestVersion, manifestToSortedJSON, yaml } from "@akashnetwork/chain-sdk/web";

export class CustomValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomValidationError";
  }
}

const specSuffixes = {
  Ki: 1024,
  Mi: 1024 * 1024,
  Gi: 1024 * 1024 * 1024,
  Ti: 1024 * 1024 * 1024 * 1024,
  Pi: 1024 * 1024 * 1024 * 1024 * 1024,
  Ei: 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
  K: 1000,
  M: 1000 * 1000,
  G: 1000 * 1000 * 1000,
  T: 1000 * 1000 * 1000 * 1000,
  P: 1000 * 1000 * 1000 * 1000 * 1000,
  E: 1000 * 1000 * 1000 * 1000 * 1000 * 1000,
  Kb: 1000,
  Mb: 1000 * 1000,
  Gb: 1000 * 1000 * 1000,
  Tb: 1000 * 1000 * 1000 * 1000,
  Pb: 1000 * 1000 * 1000 * 1000 * 1000,
  Eb: 1000 * 1000 * 1000 * 1000 * 1000 * 1000
};

export function parseSizeStr(str: string) {
  try {
    const suffix = Object.keys(specSuffixes).find(s => str.toLowerCase().endsWith(s.toLowerCase()));

    if (suffix) {
      const suffixPos = str.length - suffix.length;
      const numberStr = str.substring(0, suffixPos);
      return (parseFloat(numberStr) * specSuffixes[suffix as keyof typeof specSuffixes]).toString();
    } else {
      return parseFloat(str);
    }
  } catch (err) {
    console.error(err);
    throw new Error("Error while parsing size: " + str);
  }
}

export function parseSdlInput(yamlJson: string | SDLInput): SDLInput {
  return typeof yamlJson === "string" ? yaml.raw<SDLInput>(yamlJson) : yamlJson;
}

export function buildManifest(sdlInput: SDLInput) {
  const result = generateManifest(sdlInput);
  if (!result.ok) {
    throw new Error(result.value.map(e => e.message).join(", "));
  }
  return result.value;
}

export function DeploymentGroups(yamlJson: string | SDLInput) {
  const sdlInput = parseSdlInput(yamlJson);
  return buildManifest(sdlInput).groupSpecs;
}

export function Manifest(yamlJson: string | SDLInput): AkashManifest {
  const sdlInput = parseSdlInput(yamlJson);
  const { groups } = buildManifest(sdlInput);
  return groups;
}

export async function ManifestVersion(yamlJson: string | SDLInput) {
  const sdlInput = parseSdlInput(yamlJson);
  const { groups } = buildManifest(sdlInput);
  return generateManifestVersion(groups);
}

export function ManifestYaml(sdlConfig: string) {
  const sdlInput = parseSdlInput(sdlConfig);
  const { groups } = buildManifest(sdlInput);
  return manifestToSortedJSON(groups);
}
