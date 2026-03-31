import { atom } from "jotai";

const favoriteProviders = atom<string[]>([]);
const deploymentNameDseq = atom<string | number | null>(null);

export const localNoteStore = { favoriteProviders, deploymentNameDseq };
