import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import type { TemplateCreation } from "@src/types";

const deploySdl = atom<TemplateCreation | null>(null);
const sdlPreviewOpen = atomWithStorage<boolean>("sdlPreviewPaneOpen", false);

export default {
  deploySdl,
  sdlPreviewOpen
};
