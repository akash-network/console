"use client";
import { useEffect } from "react";
import { useAtom } from "jotai";

import { DeploymentNameModal } from "./DeploymentNameModal";
import localNoteStore from "./localNoteStore";
import { useInitFavoriteProviders, useLocalNotes } from "./useLocalNotes";

export const DEPENDENCIES = {
  DeploymentNameModal,
  useLocalNotes,
  useInitFavoriteProviders,
  useDeploymentNameDseq: () => useAtom(localNoteStore.deploymentNameDseq)
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function LocalNoteManager({ dependencies: d = DEPENDENCIES }: Props) {
  const [dseq, setDseq] = d.useDeploymentNameDseq();
  const { getDeploymentName } = d.useLocalNotes();
  const initFavoriteProviders = d.useInitFavoriteProviders();

  useEffect(() => {
    initFavoriteProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <d.DeploymentNameModal dseq={dseq} onClose={() => setDseq(null)} onSaved={() => setDseq(null)} getDeploymentName={getDeploymentName} />;
}
