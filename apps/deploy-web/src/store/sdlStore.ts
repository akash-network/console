import { atom } from "jotai";

import { RentGpusFormValues, SdlBuilderFormValues, TemplateCreation } from "@src/types";

const deploySdl = atom<TemplateCreation | null>(null);
const sdlBuilderSdl = atom<SdlBuilderFormValues | null>(null);
const rentGpuSdl = atom<RentGpusFormValues | null>(null);
const selectedSdlEditMode = atom<"yaml" | "builder">("yaml");

export default {
  deploySdl,
  sdlBuilderSdl,
  rentGpuSdl,
  selectedSdlEditMode
};
