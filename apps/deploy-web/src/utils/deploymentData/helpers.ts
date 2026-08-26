import type { Manifest as AkashManifest, SDLInput } from "@akashnetwork/chain-sdk/web";
import { generateManifest, generateManifestVersion, manifestToSortedJSON, yaml } from "@akashnetwork/chain-sdk/web";

export class CustomValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomValidationError";
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
