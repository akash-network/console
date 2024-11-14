import React, { useState } from "react";
import { Popup } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";
import providerProcessStore from "@src/store/providerProcessStore";

const ResetProviderForm: React.FunctionComponent = () => {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [, resetProcess] = useAtom(providerProcessStore.resetProviderProcess);

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const confirmReset = () => {
    resetProcess();
    setIsResetModalOpen(false);
  };

  const cancelReset = () => {
    setIsResetModalOpen(false);
  };

  const popupProps = {
    variant: "confirm",
    title: "Confirm Reset",
    message: "Are you sure you want to reset the provider process?",
    onValidate: confirmReset,
    onCancel: cancelReset,
    open: isResetModalOpen
  };

  return (
    <>
      <button type="button" onClick={handleReset}>Reset</button>
      <Popup {...popupProps} variant="confirm" />
    </>
  );
};

export default ResetProviderForm;
