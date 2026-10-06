import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk/web";
import { validateSDL } from "@akashnetwork/chain-sdk/web";
import yaml from "js-yaml";

import { formatSdlValidationError } from "@src/utils/sdl/validateGeneratedSdl";
import { isKnownSdlParserError, NoVisibleServiceError } from "../importDeploymentState/importDeploymentState";

export interface PlacementSummary {
  name: string;
  region: string | undefined;
  services: string[];
}

export type SdlImportCheck = { status: "empty" } | { status: "invalid"; reason: string } | { status: "valid"; placements: PlacementSummary[] };

const NOT_AN_SDL_REASON = "This doesn't look like an SDL. Paste a deploy.yaml with a services section.";

const UNREADABLE_SDL_REASON = "This SDL couldn't be read. Check it and try again.";

/** Checks an SDL the way applying it would, so the dialog can report problems before the user applies it; `readIntoForm` throws for an SDL the form can't hold. */
export function checkSdlImport(sdl: string, readIntoForm?: (sdl: string) => unknown): SdlImportCheck {
  if (!sdl.trim()) {
    return { status: "empty" };
  }

  let document: unknown;
  try {
    document = yaml.load(sdl);
  } catch (error) {
    return { status: "invalid", reason: describeYamlError(error) };
  }

  if (!document || typeof document !== "object") {
    return { status: "invalid", reason: NOT_AN_SDL_REASON };
  }

  try {
    readIntoForm?.(sdl);
  } catch (error) {
    return { status: "invalid", reason: describeImportError(error) };
  }

  const errors = validateSDL(document as SDLInput);
  if (errors?.length) {
    return { status: "invalid", reason: describeValidationErrors(errors) };
  }

  return { status: "valid", placements: summarizePlacements(document as SDLInput) };
}

function describeYamlError(error: unknown): string {
  if (error instanceof yaml.YAMLException) {
    return `Line ${error.mark.line + 1}: ${error.reason}`;
  }
  return UNREADABLE_SDL_REASON;
}

/** Parser and no-service errors carry a message meant for the user, while anything else is internal noise. */
function describeImportError(error: unknown): string {
  if (error instanceof NoVisibleServiceError || isKnownSdlParserError(error)) {
    return error.message;
  }
  return UNREADABLE_SDL_REASON;
}

function describeValidationErrors(errors: ValidationError[]): string {
  const [first, ...rest] = errors;
  const firstReason = formatSdlValidationError(first);
  return rest.length ? `${firstReason} (and ${rest.length} more)` : firstReason;
}

function summarizePlacements(sdl: SDLInput): PlacementSummary[] {
  const placements = new Map<string, PlacementSummary>();

  for (const [service, targets] of Object.entries(sdl.deployment)) {
    for (const name of Object.keys(targets)) {
      const placement = placements.get(name) ?? { name, region: regionOf(sdl, name), services: [] };
      placement.services.push(service);
      placements.set(name, placement);
    }
  }

  return [...placements.values()];
}

function regionOf(sdl: SDLInput, placementName: string): string | undefined {
  const region = sdl.profiles.placement[placementName].attributes?.region;
  return typeof region === "string" ? region : undefined;
}
