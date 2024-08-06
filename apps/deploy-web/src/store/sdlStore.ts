import { atom } from "jotai";

import { RentGpusFormValuesType, SdlBuilderFormValuesType, TemplateCreation } from "@src/types";

const deploySdl = atom<TemplateCreation | null>(null);
const sdlBuilderSdl = atom<SdlBuilderFormValuesType | null>(null);
const rentGpuSdl = atom<RentGpusFormValuesType | null>(null);
const selectedSdlEditMode = atom<"yaml" | "builder">("yaml");

export default {
  deploySdl,
  sdlBuilderSdl,
  rentGpuSdl,
  selectedSdlEditMode
};
