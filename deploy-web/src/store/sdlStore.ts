import { SdlBuilderFormValues, TemplateCreation } from "@src/types";
import { atom } from "jotai";

const deploySdl = atom<TemplateCreation>(null as TemplateCreation);
const sdlBuilderSdl = atom<SdlBuilderFormValues>(null as SdlBuilderFormValues);

export default {
  deploySdl,
  sdlBuilderSdl
};
