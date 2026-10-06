"use client";
import { DeploymentNameModal } from "./DeploymentNameModal";
import { useLocalNotes } from "./useLocalNotes";

export const DEPENDENCIES = {
  DeploymentNameModal,
  useLocalNotes
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function LocalNoteManager({ dependencies: d = DEPENDENCIES }: Props) {
  const { selectedDeploymentDseq, selectDeployment, deselectDeployment } = d.useLocalNotes();
  const resetSelectedDeployment = () => selectDeployment(null);

  return <d.DeploymentNameModal dseq={selectedDeploymentDseq} onClose={resetSelectedDeployment} onSaved={deselectDeployment} />;
}
