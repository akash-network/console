import type { Manifest as AkashManifest } from "@akashnetwork/chain-sdk/web";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { SdlBuilderFormValuesType } from "@src/types";
import { Manifest, ManifestVersion } from "./helpers";

export const ENDPOINT_NAME_VALIDATION_REGEX = /^[a-z]+[-_\da-z]+$/;
export const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

export function getManifest(yamlJson: any): AkashManifest {
  return Manifest(yamlJson);
}

export async function getManifestVersion(yamlJson: any) {
  const version = await ManifestVersion(yamlJson);

  return Buffer.from(version).toString("base64");
}

/**
 * Whether a GPU `vendor`/`model` pair is blocked for managed-wallet trials. Matches on the normalized,
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
 * the backend**. A specific model defers to {@link isTrialBlockedGpuModel}; an **empty** model ("any model
 * from this vendor") is treated as blocked whenever that vendor exposes **any** blocked model.
 *
 * Why stricter: unlike a specific blocked model (always broken for trials), "any nvidia" *can* succeed if an
 * allowed-model provider happens to bid — but "any" is an unreliable gamble. If no allowed-model provider bids
 * the deployment just spins with no explanation (CON-660). Forcing a trial to pick a specific *allowed* model
 * (which stays selectable) or add credits gives a deterministic outcome.
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
 * signal for "trials cannot use high-end GPUs", used to gate confidential-compute GPU (cpu-gpu) and the GPU
 * interconnect on their own merit rather than deriving them from a specific model or the stricter "any" selection
 * rule. When the blocklist is empty the whole restriction (create-time checks + per-bid filtering + interconnect
 * blocking) is a no-op, so nothing GPU-related is gated.
 */
export function isTrialGpuRestrictionActive(blockedModels: readonly string[] = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS): boolean {
  return blockedModels.length > 0;
}

/**
 * Whether a form's GPU selection would be blocked for a trial on the configure screen — the submit guard in
 * `ConfigureDeploymentHeader` uses this because enabling the GPU card leaves the model at the empty default
 * *without ever opening the (locked) picker*, so the presentational lock alone cannot stop an empty-model
 * submission. Scans only GPU-enabled services via {@link isTrialBlockedGpuSelection} (UI-only and stricter than
 * the backend, see there).
 */
export function hasTrialBlockedGpu(
  values: SdlBuilderFormValuesType,
  blockedModels: readonly string[] = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS
): boolean {
  return values.services.some(
    service => service.profile?.hasGpu && (service.profile.gpuModels ?? []).some(gpu => isTrialBlockedGpuSelection(gpu.vendor, gpu.name, blockedModels))
  );
}
