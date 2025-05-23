import { useMemo } from "react";
import { useAtom } from "jotai";

import { settingsIdAtom } from "@src/context/SettingsProvider/settingsStore";
import networkStore from "@src/store/networkStore";

export const useLocalStorage = () => {
  const [settingsId] = useAtom(settingsIdAtom);
  const selectedNetworkId = networkStore.useSelectedNetworkId();

  return useMemo(
    () => ({
      removeLocalStorageItem(key: string) {
        localStorage.removeItem(`${selectedNetworkId}${settingsId ? "/" + settingsId : ""}/${key}`);
      },
      setLocalStorageItem(key: string, value: string) {
        localStorage.setItem(`${selectedNetworkId}${settingsId ? "/" + settingsId : ""}/${key}`, value);
      },
      getLocalStorageItem(key: string) {
        return localStorage.getItem(`${selectedNetworkId}${settingsId ? "/" + settingsId : ""}/${key}`);
      }
    }),
    [selectedNetworkId, settingsId]
  );
};
