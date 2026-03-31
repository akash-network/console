"use client";
import { useCallback } from "react";
import { useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { settingsIdAtom } from "@src/context/SettingsProvider/settingsStore";
import type { LocalDeploymentData } from "@src/services/deployment-storage/deployment-storage.service";
import { getProviderLocalData, updateProviderLocalData } from "@src/utils/providerUtils";
import { localNoteStore } from "./localNoteStore";

export type LocalNotesContextType = {
  getDeploymentName: (dseq: string | number | null) => string | null;
  changeDeploymentName: (dseq: string | number) => void;
  getDeploymentData: (dseq: string | number) => Partial<LocalDeploymentData> | null;
  favoriteProviders: string[];
  updateFavoriteProviders: (newFavorites: string[]) => void;
  selectedDeploymentDseq: string | number | null;
  selectDeployment: (dseq: string | number | null) => void;
};

export function useLocalNotes(): LocalNotesContextType {
  const { deploymentLocalStorage } = useServices();
  const [settingsId] = useAtom(settingsIdAtom);
  const [favoriteProviders, setFavoriteProviders] = useAtom(localNoteStore.favoriteProviders);
  const [selectedDeploymentDseq, selectDeployment] = useAtom(localNoteStore.deploymentNameDseq);

  const getDeploymentName = useCallback(
    (dseq: string | number | null) => {
      const localData = deploymentLocalStorage.get(settingsId, dseq);
      return localData?.name ?? null;
    },
    [deploymentLocalStorage, settingsId]
  );

  const getDeploymentData = useCallback(
    (dseq: string | number) => {
      const localData = deploymentLocalStorage.get(settingsId, dseq);
      return localData ?? null;
    },
    [deploymentLocalStorage, settingsId]
  );

  const changeDeploymentName = useCallback(
    (dseq: string | number) => {
      console.log("select deployment", dseq);
      selectDeployment(dseq);
    },
    [selectDeployment]
  );

  const updateFavoriteProviders = useCallback(
    (newFavorites: string[]) => {
      updateProviderLocalData({ favorites: newFavorites });
      setFavoriteProviders(newFavorites);
    },
    [setFavoriteProviders]
  );

  return { getDeploymentName, changeDeploymentName, getDeploymentData, favoriteProviders, updateFavoriteProviders, selectedDeploymentDseq, selectDeployment };
}

export function useInitFavoriteProviders() {
  const [, setFavoriteProviders] = useAtom(localNoteStore.favoriteProviders);

  return () => {
    const localProviderData = getProviderLocalData();
    setFavoriteProviders(localProviderData.favorites);
  };
}
