import type { GenerateManifestResult, Manifest, SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest, generateManifestVersion, yaml } from "@akashnetwork/chain-sdk";
import { YAMLException } from "js-yaml";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { extractRequestedGpusFromSdl, findBlockedGpus, toBlockedGpuSet } from "@src/deployment/utils/blocked-gpu/blocked-gpu";

@singleton()
export class SdlService {
  readonly #config: BillingConfig;

  constructor(@InjectBillingConfig() config: BillingConfig) {
    this.#config = config;
  }

  generateManifest(rawSDL: string, options: { isTrialing?: boolean } = {}): GenerateManifestResult {
    let potentiallyInvalidSDL: SDLInput;

    try {
      potentiallyInvalidSDL = yaml.raw<SDLInput>(rawSDL);
    } catch (error) {
      if (error instanceof YAMLException) {
        return { ok: false, value: [{ schemaPath: "", instancePath: "", keyword: "yaml", params: {}, message: error.message }] };
      }
      throw error;
    }
    const deploymentGrantDenom = this.#config.DEPLOYMENT_GRANT_DENOM;
    const sdlPlacement =
      potentiallyInvalidSDL?.profiles?.placement && typeof potentiallyInvalidSDL?.profiles?.placement === "object"
        ? potentiallyInvalidSDL.profiles.placement
        : {};

    Object.values(sdlPlacement).forEach(profile => {
      if (typeof profile !== "object" || !profile || !profile.pricing || typeof profile.pricing !== "object") return;
      Object.values(profile.pricing).forEach(price => {
        if (typeof price !== "object" || !price || price.denom === deploymentGrantDenom) return;
        price.denom = deploymentGrantDenom;
      });
    });

    const allowedAuditors = this.#config.MANAGED_WALLET_LEASE_ALLOWED_AUDITORS;
    if (allowedAuditors && allowedAuditors.length > 0) {
      this.#appendAuditorRequirement(sdlPlacement, allowedAuditors);
    }

    const blockedGpuModels = this.#config.MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS;
    if (options.isTrialing && blockedGpuModels && blockedGpuModels.length > 0) {
      const blockedRequested = findBlockedGpus(extractRequestedGpusFromSdl(potentiallyInvalidSDL), toBlockedGpuSet(blockedGpuModels));
      if (blockedRequested.length > 0) {
        const blockedList = blockedRequested.map(({ vendor, model }) => `${vendor}/${model}`).join(", ");
        return {
          ok: false,
          value: [
            {
              schemaPath: "",
              instancePath: "/profiles/compute",
              keyword: "gpu",
              params: { blocked: blockedRequested },
              message: `GPU not available on free trial: Add credits to your account to use ${blockedList}`
            }
          ]
        };
      }
    }

    const result = generateManifest(potentiallyInvalidSDL);
    if (!result.ok) return result;

    return result;
  }

  async generateManifestVersion(manifest: Manifest): Promise<Uint8Array> {
    return generateManifestVersion(manifest);
  }

  #appendAuditorRequirement(placement: SDLInput["profiles"]["placement"], allowedAuditors: string[]): void {
    for (const value of Object.values(placement)) {
      if (!value) continue;

      for (const auditor of allowedAuditors) {
        if (!value.signedBy?.anyOf || !value.signedBy.anyOf.includes(auditor)) {
          value.signedBy ??= {};
          value.signedBy.anyOf ??= [];
          value.signedBy.anyOf.push(auditor);
        }
      }
    }
  }
}
