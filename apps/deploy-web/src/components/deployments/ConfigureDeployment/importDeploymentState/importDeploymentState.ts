import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { SdlBuilderFormValuesType } from "@src/types";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { applyImportedSshState } from "@src/utils/sdl/sshKey";
import { isVmImage } from "@src/utils/sdl/vmImages";

export interface ImportedDeploymentState {
  values: SdlBuilderFormValuesType;
  /** The imported SDL verbatim, mirroring how a carried-in SDL is used at mount. */
  sdl: string;
  selectedServiceId: string;
}

/**
 * Thrown when an SDL parses but defines no service the configure screen can work with (empty or
 * log-collector-only). Its own name lets the mount path fall back silently while the import dialog
 * shows a message.
 */
export class NoVisibleServiceError extends Error {
  override name = "NoVisibleServiceError";
}

/** Error names `importSimpleSdl` throws that carry a meaningful, user-safe message (line/col, validation detail). */
const KNOWN_SDL_PARSER_ERROR_NAMES = ["YAMLException", "CustomValidationError", "TemplateValidation"];

/** True for a recognized parser/validation failure from the import pipeline, as opposed to unexpected internal noise. */
export function isKnownSdlParserError(err: unknown): err is Error {
  return err instanceof Error && KNOWN_SDL_PARSER_ERROR_NAMES.includes(err.name);
}

/**
 * The single import pipeline for the configure screen: parses an SDL, lifts its SSH state into the
 * form model, backfills the VM expose-ssh flag, and seeds the selection. Throws `NoVisibleServiceError`
 * for a service-less SDL and rethrows parser errors (`YAMLException`, `CustomValidationError`, …) verbatim.
 */
export function importDeploymentState(sdl: string): ImportedDeploymentState {
  const values = withGpuUnitsCounted(withVmSshBackfill(applyImportedSshState(importSimpleSdl(sdl))));
  if (!hasVisibleService(values)) {
    throw new NoVisibleServiceError("This SDL doesn't define any services to configure.");
  }
  return { values, sdl, selectedServiceId: seedSelectedServiceId(values) };
}

/** Picks the first user-visible service to focus. Callers guarantee at least one service exists. */
export function seedSelectedServiceId(values: SdlBuilderFormValuesType): string {
  const visible = values.services.find(candidate => !isLogCollectorService(candidate)) ?? values.services[0];
  return visible.id;
}

/**
 * Restores the deployment-wide `hasSSHKey` flag for a carried-in deployment holding a VM service, covering
 * a VM draft saved before a key was entered (`applyImportedSshState` only flips it once a key exists). The
 * SDL itself is taken literally: no expose or key is backfilled.
 */
function withVmSshBackfill(values: SdlBuilderFormValuesType): SdlBuilderFormValuesType {
  if (values.hasSSHKey || !values.services.some(service => isVmImage(service.image))) {
    return values;
  }
  return { ...values, hasSSHKey: true };
}

/** An SDL can quote its GPU units or ask for none, and the form counts zero units as no GPU. */
function withGpuUnitsCounted(values: SdlBuilderFormValuesType): SdlBuilderFormValuesType {
  return {
    ...values,
    services: values.services.map(service => {
      const gpu = Number(service.profile.gpu) || 0;
      return { ...service, profile: { ...service.profile, gpu, hasGpu: !!service.profile.hasGpu && gpu > 0 } };
    })
  };
}

/** A usable deployment has at least one service the user can configure (log collectors don't count). */
function hasVisibleService(values: SdlBuilderFormValuesType): boolean {
  return values.services.some(service => !isLogCollectorService(service));
}
