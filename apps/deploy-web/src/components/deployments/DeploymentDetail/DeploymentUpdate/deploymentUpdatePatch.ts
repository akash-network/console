import type { SdlBuilderFormValuesType } from "@src/types";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import type { ServicesPatch } from "@src/utils/sdl/sdlServicesPatch";
import { servicesPatchBetween } from "@src/utils/sdl/sdlServicesPatch";

/** Both sides are generated from form values, so a difference is always an edit and never how the stored document happened to be spelled. */
export function servicesPatchOf(seed: SdlBuilderFormValuesType, current: SdlBuilderFormValuesType): ServicesPatch {
  return servicesPatchBetween(generateSdl(seed), generateSdl(current));
}
