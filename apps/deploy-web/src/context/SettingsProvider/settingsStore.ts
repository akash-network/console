import { atomWithStorage } from "jotai/utils";

const SETTINGS_ID_KEY = "akashSettingsId";

export const settingsIdAtom = atomWithStorage<string | null>(SETTINGS_ID_KEY, null, undefined, {
  getOnInit: true
});
