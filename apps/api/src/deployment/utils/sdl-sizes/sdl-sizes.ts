import type { GenerateManifestResult, SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { generateManifest } from "@akashnetwork/chain-sdk";

/** chain-sdk checks sizes only while building the manifest and throws this instead of returning a validation error. */
const INVALID_SIZE_MESSAGE_PREFIX = "Invalid size string: ";

export function generateManifestReportingInvalidSizes(sdl: SDLInput, generate: typeof generateManifest = generateManifest): GenerateManifestResult {
  try {
    return generate(sdl);
  } catch (error) {
    if (!isInvalidSizeError(error)) throw error;

    return { ok: false, value: [toInvalidSizeValidationError(error.message.slice(INVALID_SIZE_MESSAGE_PREFIX.length))] };
  }
}

function isInvalidSizeError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith(INVALID_SIZE_MESSAGE_PREFIX);
}

function toInvalidSizeValidationError(size: string): ValidationError {
  return {
    schemaPath: "",
    instancePath: "/profiles/compute",
    keyword: "size",
    params: {},
    message: `memory or storage size "${size}" must be a number with a unit, such as 512Mi or 1Gi`
  };
}
