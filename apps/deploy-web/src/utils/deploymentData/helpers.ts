import { SDL } from "@akashnetwork/akashjs/build/sdl";
import type { v2Sdl } from "@akashnetwork/akashjs/build/sdl/types";
import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import axios from "axios";

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

export async function getCurrentHeight(apiEndpoint: string) {
  const response = await axios.get(`${apiEndpoint}/blocks/latest`);
  const data = response.data;

  const height = parseInt(data.block.header.height);
  return height;
}

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

type NetworkType = "beta2" | "beta3";

function isValidString(value: unknown): value is string {
  return typeof value === "string" && !!value;
}

export function getSdl(yamlJson: string | v2Sdl, networkType: NetworkType, networkId: NetworkId) {
  return isValidString(yamlJson) ? SDL.fromString(yamlJson, networkType, networkId) : new SDL(yamlJson, networkType, networkId);
}

export function DeploymentGroups(yamlJson: string | v2Sdl, networkType: NetworkType, networkId: NetworkId) {
  const sdl = getSdl(yamlJson, networkType, networkId);
  return sdl.groups();
}

export function Manifest(yamlJson: string | v2Sdl, networkType: NetworkType, networkId: NetworkId, asString = false) {
  const sdl = getSdl(yamlJson, networkType, networkId);
  return sdl.manifest(asString);
}

export async function ManifestVersion(yamlJson: string | v2Sdl, networkType: NetworkType, networkId: NetworkId) {
  const sdl = getSdl(yamlJson, networkType, networkId);
  return sdl.manifestVersion();
}

export function ManifestYaml(sdlConfig: v2Sdl, networkType: NetworkType, networkId: NetworkId) {
  const sdl = getSdl(sdlConfig, networkType, networkId);
  return sdl.manifestSortedJSON();
}
