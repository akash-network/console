import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type WhatsNewView = "announcement" | "tour";

/** Kept per browser, so each release announces itself once without a round trip to the API. */
export const seenWhatsNewReleasesAtom = atomWithStorage<string[]>("console.whatsNew.seen", [], undefined, { getOnInit: true });

export const whatsNewViewAtom = atom<WhatsNewView | null>(null);
