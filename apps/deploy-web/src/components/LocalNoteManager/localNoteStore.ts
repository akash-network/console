import { atom } from "jotai";

const deploymentNameDseq = atom<string | number | null>(null);

export const localNoteStore = { deploymentNameDseq };
