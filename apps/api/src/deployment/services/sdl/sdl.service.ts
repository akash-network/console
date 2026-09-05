import type { GenerateManifestResult, Manifest, SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { generateManifest, generateManifestVersion, yaml } from "@akashnetwork/chain-sdk";
import { YAMLException } from "js-yaml";
import { inject, singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { sdlRequestsGpuInterconnect } from "@src/deployment/utils/gpu-interconnect/gpu-interconnect";
import { findTrialResourceViolation } from "@src/deployment/utils/group-resources/group-resources";
import { restatePricesInGrantDenom } from "@src/deployment/utils/price-denom/price-denom";

export type SdlParseResult = { ok: true; value: SDLInput } | { ok: false; value: ValidationError[] };
export type SdlManifest = Extract<GenerateManifestResult, { ok: true }>["value"];

export interface ResolvedSdl {
  manifest: SdlManifest;
  manifestVersion: Uint8Array;
}

export type GenerateResolvedManifestResult = { ok: true; value: ResolvedSdl } | { ok: false; value: ValidationError[] };

/** DenomExchangeService already reports a missing rate as 0, so a lookup that throws is rejected by the same guard rather than escaping as a 500. */
const UNAVAILABLE_AKT_TO_USD_RATE = 0;

@singleton()
export class SdlService {
  readonly #config: BillingConfig;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    @InjectBillingConfig() config: BillingConfig,
    private readonly blockedGpuService: BlockedGpuService,
    private readonly sdlReferenceService: SdlReferenceService,
    private readonly denomExchangeService: DenomExchangeService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#config = config;
    this.#logger = createLogger({ context: SdlService.name });
  }

  /** SDL References are validated here and never substituted, so no caller of this can hand a resolved value back to a client. */
  async generateManifest(rawSDL: string, options: { isTrialing?: boolean } = {}): Promise<GenerateManifestResult> {
    const parsed = this.parse(rawSDL);

    if (!parsed.ok) return parsed;

    const referenceErrors = this.sdlReferenceService.validate(parsed.value);

    if (referenceErrors.length > 0) return { ok: false, value: referenceErrors };

    return this.generateManifestFrom(parsed.value, options);
  }

  /** The only path that substitutes SDL References, and the only caller of the substitution walk, so a resolved manifest exists nowhere a caller has not asked for one. */
  async generateResolvedManifest(input: { sdl: string; secrets: SdlSecrets; isTrialing?: boolean }): Promise<GenerateResolvedManifestResult> {
    const parsed = this.parse(input.sdl);

    if (!parsed.ok) return parsed;

    const referenceErrors = this.sdlReferenceService.substitute(parsed.value, { secrets: input.secrets });

    if (referenceErrors.length > 0) return { ok: false, value: referenceErrors };

    const manifest = await this.generateManifestFrom(parsed.value, { isTrialing: input.isTrialing });

    if (!manifest.ok) return { ok: false, value: manifest.value };

    return { ok: true, value: { manifest: manifest.value, manifestVersion: await this.generateManifestVersion(manifest.value.groups) } };
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

  /** The one entry point that skips SDL Reference validation, because both its callers have already validated or substituted every reference. */
  async generateManifestFrom(potentiallyInvalidSDL: SDLInput, options: { isTrialing?: boolean } = {}): Promise<GenerateManifestResult> {
    const deploymentGrantDenom = this.#config.DEPLOYMENT_GRANT_DENOM;
    const sdlPlacement =
      potentiallyInvalidSDL?.profiles?.placement && typeof potentiallyInvalidSDL?.profiles?.placement === "object"
        ? potentiallyInvalidSDL.profiles.placement
        : {};

    const restatement = await restatePricesInGrantDenom(sdlPlacement, {
      grantDenom: deploymentGrantDenom,
      loadAktToUsdRate: () => this.#loadAktToUsdRate()
    });

    if (!restatement.ok) {
      this.#logger.warn({ event: "SDL_PRICE_RESTATEMENT_FAILED", deploymentGrantDenom, aktToUsdRate: restatement.aktToUsdRate });

      return {
        ok: false,
        value: [
          {
            schemaPath: "",
            instancePath: "/profiles/placement",
            keyword: "pricing",
            params: {},
            message: `Unable to convert SDL pricing to ${deploymentGrantDenom}: the AKT price is unavailable. Price your SDL in ${deploymentGrantDenom} and try again`
          }
        ]
      };
    }

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

    if (options.isTrialing) {
      const violation = findTrialResourceViolation(result.value.groupSpecs, {
        maxCpu: this.#config.MANAGED_WALLET_TRIAL_MAX_CPU,
        maxMemoryGi: this.#config.MANAGED_WALLET_TRIAL_MAX_MEMORY_GI
      });

      if (violation) {
        return {
          ok: false,
          value: [
            {
              schemaPath: "",
              instancePath: "/profiles/compute",
              keyword: "trial-resources",
              params: { kind: violation.kind },
              message: violation.message
            }
          ]
        };
      }
    }

    return result;
  }

  async generateManifestVersion(manifest: Manifest): Promise<Uint8Array> {
    return generateManifestVersion(manifest);
  }

  async #loadAktToUsdRate(): Promise<number> {
    try {
      const { price } = await this.denomExchangeService.getExchangeRateToUSD("akt");

      return price;
    } catch (error) {
      this.#logger.warn({ event: "AKT_EXCHANGE_RATE_LOOKUP_FAILED", error });

      return UNAVAILABLE_AKT_TO_USD_RATE;
    }
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
