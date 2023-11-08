import { RentGpusFormValues, SdlBuilderFormValues, TemplateCreation } from "@src/types";
import { atom } from "jotai";

const deploySdl = atom<TemplateCreation>(null as TemplateCreation);
const sdlBuilderSdl = atom<SdlBuilderFormValues>(null as SdlBuilderFormValues);
const rentGpuSdl = atom<RentGpusFormValues>(null as RentGpusFormValues);
const selectedSdlEditMode = atom<"yaml" | "builder">("yaml");

export default {
  deploySdl,
  sdlBuilderSdl,
  rentGpuSdl,
  selectedSdlEditMode
};
