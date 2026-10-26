import type { GenerateManifestResult, Manifest, SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { generateManifest } from "@akashnetwork/chain-sdk";

/** chain-sdk checks sizes only while building the manifest and throws this instead of returning a validation error. */
const INVALID_SIZE_MESSAGE_PREFIX = "Invalid size string: ";

/** Providers refuse a manifest that exposes no service globally, but only after the lease it was sent for is paid for, while the chain accepts the deployment. */
export function findMissingGlobalExposure(manifest: Manifest): ValidationError | undefined {
  const exposesGlobally = manifest.some(group => group.services.some(service => service.expose.some(expose => expose.global)));

  if (exposesGlobally) return undefined;

  return {
    schemaPath: "",
    instancePath: "/services",
    keyword: "expose",
    params: {},
    message: "at least one service must expose a port with `global: true`, because providers refuse a deployment that exposes none"
  };
}

/** The generator reads nothing but the document, so whatever it throws is something about the document that only the caller can change. */
export function generateManifestReportingBuildFailures(sdl: SDLInput, generate: typeof generateManifest = generateManifest): GenerateManifestResult {
  try {
    return builtInFull(generate(sdl));
  } catch (error) {
    if (!(error instanceof Error)) throw error;

    return { ok: false, value: [toBuildFailure(error)] };
  }
}

/** chain-sdk builds the groups and the reclamation only when they are first read, so they are read here, where what that throws is still reported. */
function builtInFull(result: GenerateManifestResult): GenerateManifestResult {
  if (!result.ok) return result;

  const { groups, groupSpecs, reclamation } = result.value;

  return { ok: true, value: { groups, groupSpecs, reclamation } };
}

function toBuildFailure({ message }: Error): ValidationError {
  if (message.startsWith(INVALID_SIZE_MESSAGE_PREFIX)) {
    return toInvalidSizeValidationError(message.slice(INVALID_SIZE_MESSAGE_PREFIX.length));
  }

  return { schemaPath: "", instancePath: "", keyword: "manifest", params: {}, message };
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
