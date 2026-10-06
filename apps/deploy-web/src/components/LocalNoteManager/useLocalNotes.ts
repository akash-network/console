"use client";
import { useCallback } from "react";
import { useAtom } from "jotai";

import { localNoteStore } from "./localNoteStore";

export type LocalNotesContextType = {
  changeDeploymentName: (dseq: string | number) => void;
  selectedDeploymentDseq: string | number | null;
  selectDeployment: (dseq: string | number | null) => void;
  deselectDeployment: (dseq: string | number) => void;
};

export function useLocalNotes(): LocalNotesContextType {
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

  return { changeDeploymentName, selectedDeploymentDseq, selectDeployment, deselectDeployment };
}
