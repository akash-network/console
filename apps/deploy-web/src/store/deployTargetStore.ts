import { atom } from "jotai";

/** The project the next deployment is created in, chosen on the way to Configure and read when the deployment is created. */
export const deployTargetProjectIdAtom = atom<string | null>(null);
