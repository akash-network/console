import type { GenerateManifestResult, Manifest, NetworkId, SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest, generateManifestVersion, yaml } from "@akashnetwork/chain-sdk";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";

@singleton()
export class SdlService {
  readonly #networkId: NetworkId;
  readonly #config: BillingConfig;

  constructor(@InjectBillingConfig() config: BillingConfig) {
    this.#networkId = config.NETWORK as NetworkId;
    this.#config = config;
  }

  generateManifest(rawSDL: string): GenerateManifestResult {
    const potentiallyInvalidSDL = yaml.template<SDLInput>(rawSDL);
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

    const result = generateManifest(potentiallyInvalidSDL, this.#networkId);
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
