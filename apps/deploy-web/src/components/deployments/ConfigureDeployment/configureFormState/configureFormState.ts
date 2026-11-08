import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultServiceWithPlacement, exampleImageServiceOverrides, vmServiceOverrides } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { withSecretsMarkedLike } from "@src/utils/sdl/sdlSecrets";
import { applyPresetToProfile, DEFAULT_HARDWARE_PRESET } from "../ConfigurationPane/PresetsCard/hardwarePresets";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { importDeploymentState, isKnownSdlParserError, NoVisibleServiceError, seedSelectedServiceId } from "../importDeploymentState/importDeploymentState";
import type { PlacementRegionPicks } from "../useConfigureDraft/useConfigureDraft";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";

/** What a fresh deployment is seeded with when nothing was carried in. */
export type DefaultSeed = Pick<DeploymentIntent, "vm" | "exampleImage">;

export interface InitialState {
  values: SdlBuilderFormValuesType;
  sdl: string;
  selectedServiceId: string;
  changes: string[];
  importError?: string;
}

/**
 * Derives the form values, preview SDL, and initial selection from one source so they can never diverge.
 * A carried-in SDL is used only when it imports to a usable deployment (at least one visible service);
 * otherwise — invalid YAML, or a service-less SDL the configure screen can't work with — the screen falls
 * back to a default deployment. This guarantees there is always a service (and placement) to select.
 * A Container-VM entry (`vm`) seeds an SSH-ready VM service instead of the blank default, and an `exampleImage`
 * entry seeds the default service with a working example image.
 */
export function getInitialState(carriedInSdl: string | undefined, seed: DefaultSeed, placementRegions?: PlacementRegionPicks): InitialState {
  if (!carriedInSdl) return defaultInitialState(seed);

  try {
    const imported = withRestoredRegions(importDeploymentState(carriedInSdl), placementRegions);
    return { ...imported, sdl: sdlOfImportedState(imported) };
  } catch (error) {
    if (error instanceof NoVisibleServiceError) return defaultInitialState(seed);
    return defaultInitialState(seed, getImportErrorMessage(error));
  }
}

/** Several picked regions never reach the SDL, so a restored draft takes them back from beside it. */
function withRestoredRegions(state: ImportedDeploymentState, placementRegions: PlacementRegionPicks | undefined): ImportedDeploymentState {
  const placements = state.values.placements.map(placement => ({ ...placement, regions: placementRegions?.[placement.name] ?? placement.regions }));
  return { ...state, values: { ...state.values, placements } };
}

/** An imported SDL is regenerated from its values rather than shown verbatim, so a registry password typed inside it carries a reference instead of sitting in the draft in the clear. */
export function sdlOfImportedState(state: ImportedDeploymentState): string {
  return regenerateSdl(state.values, state.sdl);
}

/** The starting SDL as the draft may hold it, sealed like the working SDL, variables marked secret since included; one that no longer imports is not worth keeping. */
export function draftableSdlOf(sdl: string, services: ServiceType[]): string | undefined {
  try {
    return generateSdl(withSecretsMarkedLike(importDeploymentState(sdl).values, services), { sealSecrets: true });
  } catch {
    return undefined;
  }
}

/** A fresh default deployment (or SSH-ready VM or example image deployment), optionally annotated with the error that made an import unusable. */
function defaultInitialState({ vm: isVm, exampleImage }: DefaultSeed, importError?: string): InitialState {
  const values = isVm
    ? { ...withDefaultPreset(defaultServiceWithPlacement(vmServiceOverrides())), hasSSHKey: true }
    : withDefaultPreset(defaultServiceWithPlacement(exampleImage ? exampleImageServiceOverrides() : undefined));
  return { values, sdl: regenerateSdl(values, ""), selectedServiceId: seedSelectedServiceId(values), changes: [], importError };
}

/** Seeds the fresh deployment's service on the default (small) hardware preset so the screen opens deployable. */
function withDefaultPreset(values: SdlBuilderFormValuesType): SdlBuilderFormValuesType {
  const [service, ...rest] = values.services;
  return { ...values, services: [{ ...service, profile: applyPresetToProfile(service.profile, DEFAULT_HARDWARE_PRESET) }, ...rest] };
}

/**
 * Maps an SDL import failure to a fixed, user-facing message. The raw exception
 * text is intentionally not surfaced: it's parser-internal and untrusted, so
 * keeping it out of the rendered DOM avoids any injection surface.
 */
function getImportErrorMessage(error: unknown): string {
  if (isKnownSdlParserError(error)) {
    return "The deployment couldn't be loaded because its SDL is invalid.";
  }
  return "The deployment couldn't be loaded.";
}

/** Regenerates the preview SDL, keeping the last good output while the form is mid-edit. */
export function regenerateSdl(values: SdlBuilderFormValuesType, previous: string): string {
  try {
    return generateSdl(values, { sealSecrets: true });
  } catch {
    return previous;
  }
}
