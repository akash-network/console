import type { GenerateManifestResult, ValidationError } from "@akashnetwork/chain-sdk";
import { singleton } from "tsyringe";

import { ConsoleReferenceService } from "@src/deployment/services/console-reference/console-reference.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";

export type SdlManifest = Extract<GenerateManifestResult, { ok: true }>["value"];

export interface ResolvedSdl {
  manifest: SdlManifest;
  manifestVersion: Uint8Array;
}

export type ResolveSdlResult = { ok: true; value: ResolvedSdl } | { ok: false; value: ValidationError[] };

/** The only path that substitutes Console References, so a resolved manifest exists nowhere a caller has not asked for one. */
@singleton()
export class ResolvedSdlService {
  constructor(
    private readonly sdlService: SdlService,
    private readonly consoleReferenceService: ConsoleReferenceService
  ) {}

  async resolve(input: { sdl: string; secrets: SdlSecrets; isTrialing?: boolean }): Promise<ResolveSdlResult> {
    const parsed = this.sdlService.parse(input.sdl);

    if (!parsed.ok) return parsed;

    const referenceErrors = this.consoleReferenceService.substitute(parsed.value, { secrets: input.secrets });

    if (referenceErrors.length > 0) return { ok: false, value: referenceErrors };

    const manifest = this.sdlService.generateManifestFrom(parsed.value, { isTrialing: input.isTrialing });

    if (!manifest.ok) return { ok: false, value: manifest.value };

    return {
      ok: true,
      value: {
        manifest: manifest.value,
        manifestVersion: await this.sdlService.generateManifestVersion(manifest.value.groups)
      }
    };
  }
}
