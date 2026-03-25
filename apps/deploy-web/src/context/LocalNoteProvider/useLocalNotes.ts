"use client";
import { useAtom } from "jotai";

import type { LocalDeploymentData } from "@src/services/deployment-storage/deployment-storage.service";
import { getProviderLocalData, updateProviderLocalData } from "@src/utils/providerUtils";
import { useServices } from "../ServicesProvider";
import { settingsIdAtom } from "../SettingsProvider/settingsStore";
import localNoteStore from "./localNoteStore";

export type LocalNotesContextType = {
  getDeploymentName: (dseq: string | number | null) => string | null;
  changeDeploymentName: (dseq: string | number) => void;
  getDeploymentData: (dseq: string | number) => Partial<LocalDeploymentData> | null;
  favoriteProviders: string[];
  updateFavoriteProviders: (newFavorites: string[]) => void;
};

export function useLocalNotes(): LocalNotesContextType {
  const { deploymentLocalStorage } = useServices();
  const [settingsId] = useAtom(settingsIdAtom);
  const [favoriteProviders, setFavoriteProviders] = useAtom(localNoteStore.favoriteProviders);
  const [, setDseq] = useAtom(localNoteStore.deploymentNameDseq);

  const getDeploymentName = (dseq: string | number | null) => {
    const localData = deploymentLocalStorage.get(settingsId, dseq);
    return localData?.name ?? null;
  };

  const getDeploymentData = (dseq: string | number) => {
    const localData = deploymentLocalStorage.get(settingsId, dseq);
    return localData ?? null;
  };

  const changeDeploymentName = (dseq: string | number) => {
    setDseq(dseq);
  };

  const updateFavoriteProviders = (newFavorites: string[]) => {
    updateProviderLocalData({ favorites: newFavorites });
    setFavoriteProviders(newFavorites);
  };

  return { getDeploymentName, changeDeploymentName, getDeploymentData, favoriteProviders, updateFavoriteProviders };
}

/**
 * @deprecated Use {@link LocalNotesContextType} instead
 */
export type ContextType = LocalNotesContextType;

export function useInitFavoriteProviders() {
  const [, setFavoriteProviders] = useAtom(localNoteStore.favoriteProviders);

  return () => {
    const localProviderData = getProviderLocalData();
    setFavoriteProviders(localProviderData.favorites);
  };
}
