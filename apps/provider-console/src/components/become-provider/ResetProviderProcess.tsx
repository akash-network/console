import React, { useState } from "react";
import { Popup } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";

import providerProcessStore from "@src/store/providerProcessStore";

export const ResetProviderForm: React.FC = () => {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [, resetProcess] = useAtom(providerProcessStore.resetProviderProcess);

  const openResetModal = () => {
    setIsResetModalOpen(true);
  };

  const resetAndCloseModal = () => {
    resetProcess();
    setIsResetModalOpen(false);
  };

  const closeModal = () => {
    setIsResetModalOpen(false);
  };

  const popupProps = {
    variant: "confirm",
    title: "Confirm Reset",
    message: "Are you sure you want to reset the provider process?",
    onValidate: resetAndCloseModal,
    onCancel: closeModal,
    open: isResetModalOpen
  };

  return (
    <>
      <button type="button" onClick={openResetModal}>
        Reset
      </button>
      <Popup {...popupProps} variant="confirm" />
    </>
  );
};
