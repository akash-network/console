"use client";
import { useEffect } from "react";

import { DeploymentNameModal } from "./DeploymentNameModal";
import { useInitFavoriteProviders, useLocalNotes } from "./useLocalNotes";

export const DEPENDENCIES = {
  DeploymentNameModal,
  useLocalNotes,
  useInitFavoriteProviders
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function LocalNoteManager({ dependencies: d = DEPENDENCIES }: Props) {
  const { getDeploymentName, selectedDeploymentDseq, selectDeployment } = d.useLocalNotes();
  const initFavoriteProviders = d.useInitFavoriteProviders();
  const resetSelectedDeployment = () => selectDeployment(null);

  useEffect(() => {
    initFavoriteProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <d.DeploymentNameModal
      dseq={selectedDeploymentDseq}
      onClose={resetSelectedDeployment}
      onSaved={resetSelectedDeployment}
      getDeploymentName={getDeploymentName}
    />
  );
}
