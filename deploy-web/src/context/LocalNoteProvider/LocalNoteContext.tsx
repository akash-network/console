import { LocalDeploymentData, getDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { getProviderLocalData, updateProviderLocalData } from "@src/utils/providerUtils";
import React, { useState, useEffect } from "react";
import { DeploymentNameModal } from "./DeploymentNameModal";

type ContextType = {
  getDeploymentName: (dseq: string | number) => string;
  changeDeploymentName: (dseq: string | number) => void;
  getDeploymentData: (dseq: string | number) => LocalDeploymentData;
  favoriteProviders: string[];
  updateFavoriteProviders: (newFavorites: string[]) => void;
};

const LocalNoteProviderContext = React.createContext<Partial<ContextType>>({});

export const LocalNoteProvider = ({ children }) => {
  const [dseq, setDseq] = useState<number | string | null>(null);
  const [favoriteProviders, setFavoriteProviders] = useState<string[]>([]);

  useEffect(() => {
    const localProviderData = getProviderLocalData();
    setFavoriteProviders(localProviderData.favorites);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFavoriteProviders = (newFavorites: string[]) => {
    updateProviderLocalData({ favorites: newFavorites });
    setFavoriteProviders(newFavorites);
  };

  const getDeploymentName = (dseq: string | number) => {
    const localData = getDeploymentLocalData(dseq);

    if (localData) {
      return localData.name;
    }

    return null;
  };

  const getDeploymentData = (dseq: string | number) => {
    const localData = getDeploymentLocalData(dseq);

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
