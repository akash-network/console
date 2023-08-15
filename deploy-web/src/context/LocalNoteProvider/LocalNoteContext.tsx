import { getDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { getProviderLocalData, updateProviderLocalData } from "@src/utils/providerUtils";
import React, { useState, useEffect } from "react";
import { DeploymentNameModal } from "./DeploymentNameModal";

type ContextType = {
  getDeploymentName: (dseq: string | number) => string;
  changeDeploymentName: (dseq: string | number) => void;
  getDeploymentData: (dseq: string | number) => any; // TODO Type
  favoriteProviders: any; // TODO: type
  updateFavoriteProviders: (newFavorites: any) => void; // TODO
};

const LocalNoteProviderContext = React.createContext<Partial<ContextType>>({});

export const LocalNoteProvider = ({ children }) => {
  const [dseq, setDseq] = useState(null);
  const [favoriteProviders, setFavoriteProviders] = useState([]);

  useEffect(() => {
    const localProviderData = getProviderLocalData();
    setFavoriteProviders(localProviderData.favorites);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFavoriteProviders = newFavorites => {
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

    if (localData) {
      return localData;
    }

    return null;
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
