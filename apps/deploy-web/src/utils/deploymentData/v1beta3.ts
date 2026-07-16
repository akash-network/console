import type { Attribute } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Manifest as AkashManifest, SDLInput } from "@akashnetwork/chain-sdk/web";
import { generateManifestVersion } from "@akashnetwork/chain-sdk/web";
import yaml from "js-yaml";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { DepositParams } from "@src/types/deployment";
import { buildManifest, CustomValidationError, Manifest, ManifestVersion, parseSdlInput } from "./helpers";

export const ENDPOINT_NAME_VALIDATION_REGEX = /^[a-z]+[-_\da-z]+$/;
export const TRIAL_ATTRIBUTE = "console/trials";
export const TRIAL_REGISTERED_ATTRIBUTE = "console/trials-registered";
export const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
export const MANAGED_WALLET_ALLOWED_AUDITORS = [AUDITOR];

export function getManifest(yamlJson: any): AkashManifest {
  return Manifest(yamlJson);
}

export async function getManifestVersion(yamlJson: any) {
  const version = await ManifestVersion(yamlJson);

  return Buffer.from(version).toString("base64");
}

const getDenomFromSdl = (groups: GroupSpec[]): string => {
  const denoms = groups.flatMap(g => g.resources).map(resource => resource.price?.denom);

  // TODO handle multiple denoms in an sdl? (different denom for each service?)
  return denoms.find(d => !!d)!;
};

export function appendTrialAttribute(yamlStr: string, attributeKey: string) {
  const sdlData = yaml.load(yamlStr) as SDLInput;
  const placementData = sdlData?.profiles?.placement || {};

  for (const [, value] of Object.entries(placementData)) {
    if (!value.attributes) {
      value.attributes = {};
    } else if (Array.isArray(value.attributes)) {
      value.attributes = (value.attributes as unknown as Attribute[]).reduce<Record<string, unknown>>((acc, curr) => ((acc[curr.key] = curr.value), acc), {});
    }

    const attrs = value.attributes as Record<string, unknown>;
    if (!(attributeKey in attrs)) {
      attrs[attributeKey] = "true";
    }

    if (!value.signedBy?.anyOf || !value.signedBy?.allOf) {
      value.signedBy = {
        anyOf: value.signedBy?.anyOf || [],
        allOf: value.signedBy?.allOf || []
      };
    }

    if (value?.signedBy?.allOf && !value.signedBy.allOf.includes(AUDITOR)) {
      value.signedBy.allOf.push(AUDITOR);
    }
  }

  const result = yaml.dump(sdlData, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty" // dump null as empty value
    }
  });

  return `---
${result}`;
}

export function appendAuditorRequirement(yamlStr: string) {
  const sdlData = yaml.load(yamlStr) as SDLInput;
  const placementData = sdlData?.profiles?.placement || {};

  for (const [, value] of Object.entries(placementData)) {
    if (!value.signedBy?.anyOf || !value.signedBy?.allOf) {
      value.signedBy = {
        anyOf: value.signedBy?.anyOf || [],
        allOf: value.signedBy?.allOf || []
      };
    }

    for (const auditor of MANAGED_WALLET_ALLOWED_AUDITORS) {
      if (value?.signedBy?.anyOf && !value.signedBy.anyOf.includes(auditor)) {
        value.signedBy.anyOf.push(auditor);
      }
    }
  }

  const result = yaml.dump(sdlData, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty"
    }
  });

  return `---
${result}`;
}

/**
 * Whether a GPU `vendor`/`model` pair is blocked for managed-wallet trials — the single source of
 * truth shared by the trial SDL policy ({@link applyTrialGpuPolicy}) and the configure-screen UI,
 * so the options the UI locks are exactly the ones the policy strips. Matches on the normalized,
 * lower-cased `vendor/model` key; a missing vendor or model is never blocked.
 */
export function isTrialBlockedGpuModel(
  vendor: string | null | undefined,
  model: string | null | undefined,
  blockedModels: readonly string[] = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS
): boolean {
  if (!vendor || !model) return false;
  return blockedModels.includes(`${vendor.toLowerCase()}/${model.toLowerCase()}`);
}

/**
 * UI-only trial GPU predicate for the "Configure your deployment" screen, and **intentionally stricter than
 * the SDL trial policy** ({@link applyTrialGpuPolicy}) and the backend. A specific model defers to
 * {@link isTrialBlockedGpuModel}; an **empty** model ("any model from this vendor") is treated as blocked
 * whenever that vendor exposes **any** blocked model.
 *
 * Why stricter: unlike a specific blocked model (always broken for trials), "any nvidia" *can* succeed if an
 * allowed-model provider happens to bid — but "any" is an unreliable gamble. If no allowed-model provider bids
 * the deployment just spins with no explanation (CON-660). Forcing a trial to pick a specific *allowed* model
 * (which stays selectable) or add credits gives a deterministic outcome. This predicate must **not** be reused
 * by {@link applyTrialGpuPolicy}, which deliberately leaves "any" as `null` and punts enforcement to accept-bid.
 *
 * The `/` delimiter on the prefix check avoids vendor prefix collisions (e.g. `nvidia` vs `nvidiax`). A missing
 * vendor is never blocked.
 */
export function isTrialBlockedGpuSelection(
  vendor: string | null | undefined,
  model: string | null | undefined,
  blockedModels: readonly string[] = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS
): boolean {
  if (!vendor) return false;
  if (model) return isTrialBlockedGpuModel(vendor, model, blockedModels);
  return blockedModels.some(entry => entry.startsWith(`${vendor.toLowerCase()}/`));
}

/**
 * Whether the managed-wallet trial GPU restriction is switched on at all (any model is blocklisted). This is the
 * signal for "trials cannot use high-end GPUs", used to gate confidential-compute GPU (cpu-gpu) on its own merit
 * rather than deriving it from a specific model or the stricter "any" selection rule. When the blocklist is empty
 * the whole restriction (SDL stripping + per-bid filtering) is a no-op, so nothing GPU-related is gated.
 */
export function isTrialGpuRestrictionActive(blockedModels: readonly string[] = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS): boolean {
  return blockedModels.length > 0;
}

/**
 * Whether a form's GPU selection would be blocked for a trial on the configure screen — the submit guard in
 * `ConfigureDeploymentHeader` uses this because enabling the GPU card leaves the model at the empty default
 * *without ever opening the (locked) picker*, so the presentational lock alone cannot stop an empty-model
 * submission. Scans only GPU-enabled services via {@link isTrialBlockedGpuSelection} (UI-only, stricter than
 * the SDL policy — see there).
 */
export function hasTrialBlockedGpu(
  values: SdlBuilderFormValuesType,
  blockedModels: readonly string[] = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS
): boolean {
  return values.services.some(
    service => service.profile?.hasGpu && (service.profile.gpuModels ?? []).some(gpu => isTrialBlockedGpuSelection(gpu.vendor, gpu.name, blockedModels))
  );
}

export function applyTrialGpuPolicy(
  yamlStr: string,
  blockedModels: readonly string[] = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS
): string {
  const sdlData = yaml.load(yamlStr) as SDLInput;
  const computeProfiles = sdlData?.profiles?.compute;
  if (!computeProfiles || typeof computeProfiles !== "object") return yamlStr;

  if (blockedModels.length === 0) return yamlStr;
  let mutated = false;

  for (const profile of Object.values(computeProfiles)) {
    const gpu = profile?.resources?.gpu;
    const vendorMap = gpu?.attributes?.vendor as Record<string, Array<{ model?: string; ram?: string; interface?: string }> | null | undefined> | undefined;
    if (!vendorMap) continue;

    for (const vendor of Object.keys(vendorMap)) {
      const models = Array.isArray(vendorMap[vendor]) ? vendorMap[vendor]! : [];
      const allowed = models.filter(entry => entry?.model && !isTrialBlockedGpuModel(vendor, entry.model, blockedModels));

      if (allowed.length === 0) {
        if (vendorMap[vendor] === null) continue;
        // Empty value = any model from this vendor (caught at CreateLease if blocked).
        vendorMap[vendor] = null;
        mutated = true;
      } else if (allowed.length !== models.length) {
        vendorMap[vendor] = allowed;
        mutated = true;
      }
    }
  }

  if (!mutated) return yamlStr;

  const result = yaml.dump(sdlData, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty"
    }
  });

  return `---
${result}`;
}

export function replaceSdlDenom(yamlStr: string, denom: string): string {
  const sdlData = yaml.load(yamlStr) as SDLInput;
  const placementData = sdlData?.profiles?.placement || {};

  for (const [, placement] of Object.entries(placementData)) {
    const pricing = placement.pricing || {};
    for (const [, price] of Object.entries(pricing)) {
      if (price.denom) {
        price.denom = denom as typeof price.denom;
      }
    }
  }

  const result = yaml.dump(sdlData, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty"
    }
  });

  return `---
${result}`;
}

export async function NewDeploymentData(
  yamlStr: string,
  dseq: string | null,
  fromAddress: string,
  deposit: number | DepositParams[] = browserEnvConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT
) {
  try {
    const sdlInput = parseSdlInput(yamlStr);
    const manifest = buildManifest(sdlInput);
    const groups = manifest.groupSpecs;
    const mani = manifest.groups;
    const denom = getDenomFromSdl(groups);
    const version = await generateManifestVersion(manifest.groups);
    const _deposit = (Array.isArray(deposit) && deposit.find(d => d.denom === denom)) || { denom, amount: deposit.toString() };

    const finalDseq: string = dseq || Date.now().toString();

    return {
      sdl: sdlInput,
      manifest: mani,
      groups: groups,
      deploymentId: {
        owner: fromAddress,
        dseq: finalDseq
      },
      orderId: [],
      leaseId: [],
      hash: version,
      deposit: _deposit,
      reclamation: manifest.reclamation
    };
  } catch (e: any) {
    const error = new CustomValidationError(e.message);
    error.stack = e.stack;
    throw error;
  }
}
