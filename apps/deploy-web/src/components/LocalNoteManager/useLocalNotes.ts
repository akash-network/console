"use client";
import { useCallback } from "react";
import { useAtom } from "jotai";

import { getProviderLocalData, updateProviderLocalData } from "@src/utils/providerUtils";
import { localNoteStore } from "./localNoteStore";

export type LocalNotesContextType = {
  changeDeploymentName: (dseq: string | number) => void;
  favoriteProviders: string[];
  updateFavoriteProviders: (newFavorites: string[]) => void;
  selectedDeploymentDseq: string | number | null;
  selectDeployment: (dseq: string | number | null) => void;
  deselectDeployment: (dseq: string | number) => void;
};

export function useLocalNotes(): LocalNotesContextType {
  const [favoriteProviders, setFavoriteProviders] = useAtom(localNoteStore.favoriteProviders);
  const [selectedDeploymentDseq, selectDeployment] = useAtom(localNoteStore.deploymentNameDseq);

  const changeDeploymentName = useCallback(
    (dseq: string | number) => {
      selectDeployment(dseq);
    },
    [selectDeployment]
  );

  /** A rename that completes after the dialog moved on to another deployment must not close that one. */
  const deselectDeployment = useCallback(
    (dseq: string | number) => {
      selectDeployment(current => (String(current) === String(dseq) ? null : current));
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

  return { changeDeploymentName, favoriteProviders, updateFavoriteProviders, selectedDeploymentDseq, selectDeployment, deselectDeployment };
}

export function useInitFavoriteProviders() {
  const [, setFavoriteProviders] = useAtom(localNoteStore.favoriteProviders);

  return () => {
    const localProviderData = getProviderLocalData();
    setFavoriteProviders(localProviderData.favorites);
  };
}
