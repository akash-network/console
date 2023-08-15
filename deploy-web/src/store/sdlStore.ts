import { TemplateCreation } from "@src/types";
import { atom } from "jotai";

const deploySdl = atom<TemplateCreation>(null as TemplateCreation);

export default {
  deploySdl
};
