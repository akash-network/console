import { atom } from "jotai";

import type { SdlBuilderFormValuesType, TemplateCreation } from "@src/types";

const deploySdl = atom<TemplateCreation | null>(null);
const sdlBuilderSdl = atom<SdlBuilderFormValuesType | null>(null);
const selectedSdlEditMode = atom<"yaml" | "builder">("yaml");

export default {
  deploySdl,
  sdlBuilderSdl,
  selectedSdlEditMode
};
