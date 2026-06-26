import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk/web";
import { validateSDL } from "@akashnetwork/chain-sdk/web";
import yaml from "js-yaml";

/**
 * Runs the chain-sdk SDL validator over a generated SDL YAML string and returns
 * human-readable error messages (empty when the SDL is valid). This is the same
 * validation the SDL editor surfaces as inline markers, lifted out so the
 * builder flow can gate "Request quotes" on it too.
 *
 * `validateSDL` enforces semantic rules the zod form schema can't, most notably
 * the TEE rules: a `cpu-gpu` service must declare GPU resources, and the `tee`
 * value must be one of the allowed types. A YAML that doesn't parse into an
 * object yields no errors here — the generator only ever emits valid YAML, and
 * structural form problems are already caught by the zod schema.
 */
export function validateGeneratedSdl(sdl: string): string[] {
  let parsed: unknown;
  try {
    parsed = yaml.load(sdl);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const errors = validateSDL(parsed as SDLInput);
  return (errors ?? []).map(formatSdlValidationError);
}

/**
 * Formats a single chain-sdk validation error into a readable line, prefixed
 * with the offending instance path. Shared with the SDL editor's Monaco markers
 * so both surfaces phrase the same error identically.
 */
export function formatSdlValidationError(error: ValidationError): string {
  const path = error.instancePath || "(root)";
  const baseMessage = error.message || "Validation error";

  if (error.keyword === "required" && error.params && "missingProperty" in error.params) {
    return `${path}: missing required property '${error.params.missingProperty}'`;
  }

  if (error.keyword === "additionalProperties" && error.params && "additionalProperty" in error.params) {
    return `${path}: unknown property '${error.params.additionalProperty}'`;
  }

  if (error.keyword === "type" && error.params && "type" in error.params) {
    return `${path}: ${baseMessage} (expected ${error.params.type})`;
  }

  return `${path}: ${baseMessage}`;
}
