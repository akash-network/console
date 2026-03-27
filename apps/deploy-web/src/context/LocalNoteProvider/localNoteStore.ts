import { atom } from "jotai";

const favoriteProviders = atom<string[]>([]);
const deploymentNameDseq = atom<string | number | null>(null);

const localNoteStore = { favoriteProviders, deploymentNameDseq };

export default localNoteStore;
