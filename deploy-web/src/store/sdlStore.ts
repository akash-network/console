import { RentGpusFormValues, SdlBuilderFormValues, TemplateCreation } from "@src/types";
import { atom } from "jotai";

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
