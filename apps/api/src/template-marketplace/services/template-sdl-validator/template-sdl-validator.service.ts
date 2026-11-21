import type { ValidationError } from "@akashnetwork/chain-sdk";
import { singleton } from "tsyringe";

import { SdlService, type YamlErrorParams } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { generateManifestReportingBuildFailures } from "@src/deployment/utils/sdl-manifest/sdl-manifest";

const UNREADABLE_SDL_ISSUE = "The SDL could not be read";
const NO_SERVICES_ISSUE = "The SDL defines no services";

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIssue({ keyword, message, params }: ValidationError): string {
  if (keyword !== "yaml") return message;

  const { reason, line, column }: Partial<YamlErrorParams> = params;
  const position = line && column ? ` (line ${line}, column ${column})` : "";

  return `${UNREADABLE_SDL_ISSUE}: ${reason}${position}`;
}

@singleton()
export class TemplateSdlValidatorService {
  constructor(
    private readonly sdlService: SdlService,
    private readonly sdlReferenceService: SdlReferenceService
  ) {}

  /** Holds a template to what a deployment of it must pass, so a malformed env or credentials block cannot slip a plaintext secret past the value checks. */
  findIssues(sdl: string): string[] {
    const parsed = this.sdlService.parse(sdl);

    if (!parsed.ok) return parsed.value.map(toIssue);
    if (!isMapping(parsed.value)) return [UNREADABLE_SDL_ISSUE];
    if (!isMapping(parsed.value.services) || Object.keys(parsed.value.services).length === 0) return [NO_SERVICES_ISSUE];

    const referenceErrors = this.sdlReferenceService.validate(parsed.value);
    if (referenceErrors.length > 0) return referenceErrors.map(toIssue);

    const manifest = generateManifestReportingBuildFailures(parsed.value);

    return manifest.ok ? [] : manifest.value.map(toIssue);
  }
}
