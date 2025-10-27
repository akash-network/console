"use client";
import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";

import type { LocalDeploymentData } from "@src/services/deployment-storage/deployment-storage.service";
import { getProviderLocalData, updateProviderLocalData } from "@src/utils/providerUtils";
import { useServices } from "../ServicesProvider";
import { settingsIdAtom } from "../SettingsProvider/settingsStore";
import { DeploymentNameModal } from "./DeploymentNameModal";

type ContextType = {
  getDeploymentName: (dseq: string | number) => string | null | undefined;
  changeDeploymentName: (dseq: string | number) => void;
  getDeploymentData: (dseq: string | number) => Partial<LocalDeploymentData> | null;
  favoriteProviders: string[];
  updateFavoriteProviders: (newFavorites: string[]) => void;
};

const LocalNoteProviderContext = React.createContext<ContextType>({} as ContextType);

export const LocalNoteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { deploymentLocalStorage } = useServices();
  const [dseq, setDseq] = useState<number | string | null>(null);
  const [favoriteProviders, setFavoriteProviders] = useState<string[]>([]);
  const [settingsId] = useAtom(settingsIdAtom);

  useEffect(() => {
    const localProviderData = getProviderLocalData();
    setFavoriteProviders(localProviderData.favorites);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFavoriteProviders = (newFavorites: string[]) => {
    updateProviderLocalData({ favorites: newFavorites });
    setFavoriteProviders(newFavorites);
  };

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

  return (
    <LocalNoteProviderContext.Provider value={{ getDeploymentName, changeDeploymentName, getDeploymentData, favoriteProviders, updateFavoriteProviders }}>
      <DeploymentNameModal dseq={dseq} onClose={() => setDseq(null)} onSaved={() => setDseq(null)} getDeploymentName={getDeploymentName} />
      {children}
    </LocalNoteProviderContext.Provider>
  );
};

export const useLocalNotes = () => {
  return { ...React.useContext(LocalNoteProviderContext) };
};
