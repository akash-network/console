import type { GenerateManifestResult, Manifest, SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { generateManifest, generateManifestVersion, yaml } from "@akashnetwork/chain-sdk";
import { YAMLException } from "js-yaml";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import { ConsoleReferenceService } from "@src/deployment/services/console-reference/console-reference.service";
import { sdlRequestsGpuInterconnect } from "@src/deployment/utils/gpu-interconnect/gpu-interconnect";

export type SdlParseResult = { ok: true; value: SDLInput } | { ok: false; value: ValidationError[] };

@singleton()
export class SdlService {
  readonly #config: BillingConfig;

  constructor(
    @InjectBillingConfig() config: BillingConfig,
    private readonly blockedGpuService: BlockedGpuService,
    private readonly consoleReferenceService: ConsoleReferenceService
  ) {
    this.#config = config;
  }

  /** Console References are validated here and never substituted, so no caller of this can hand a resolved value back to a client. */
  generateManifest(rawSDL: string, options: { isTrialing?: boolean } = {}): GenerateManifestResult {
    const parsed = this.parse(rawSDL);

    if (!parsed.ok) return parsed;

    const referenceErrors = this.consoleReferenceService.validate(parsed.value);

    if (referenceErrors.length > 0) return { ok: false, value: referenceErrors };

    return this.generateManifestFrom(parsed.value, options);
  }

  parse(rawSDL: string): SdlParseResult {
    try {
      return { ok: true, value: yaml.raw<SDLInput>(rawSDL) };
    } catch (error) {
      if (error instanceof YAMLException) {
        return { ok: false, value: [{ schemaPath: "", instancePath: "", keyword: "yaml", params: {}, message: error.message }] };
      }
      throw error;
    }
  }

  /** The one entry point that skips Console Reference validation, because both its callers have already validated or substituted every reference. */
  generateManifestFrom(potentiallyInvalidSDL: SDLInput, options: { isTrialing?: boolean } = {}): GenerateManifestResult {
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

    if (options.isTrialing) {
      const blockedRequested = this.blockedGpuService.findInSdl(potentiallyInvalidSDL);
      if (blockedRequested.length > 0) {
        return {
          ok: false,
          value: [
            {
              schemaPath: "",
              instancePath: "/profiles/compute",
              keyword: "gpu",
              params: { blocked: blockedRequested },
              message: `${this.blockedGpuService.formatList(blockedRequested)} not available on free trial: Add funds to unlock GPU access`
            }
          ]
        };
      }

      if (this.blockedGpuService.hasBlockedModels() && sdlRequestsGpuInterconnect(potentiallyInvalidSDL)) {
        return {
          ok: false,
          value: [
            {
              schemaPath: "",
              instancePath: "/profiles/compute",
              keyword: "gpu-interconnect",
              params: {},
              message: "GPU interconnect not available on free trial: Add funds to unlock GPU interconnect"
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
