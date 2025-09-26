import { useMemo } from "react";
import { useAtom } from "jotai";

import { useRootContainer } from "@src/context/ServicesProvider/RootContainerProvider";
import { settingsIdAtom } from "@src/context/SettingsProvider/settingsStore";

export const useLocalStorage = () => {
  const [settingsId] = useAtom(settingsIdAtom);
  const { networkStore } = useRootContainer();
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
