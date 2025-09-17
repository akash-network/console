"use client";
import React from "react";
import { Popup } from "@akashnetwork/ui/components";

import { ThreeDSecureModal } from "./ThreeDSecureModal";

interface ThreeDSecurePopupProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
  clientSecret: string;
  paymentIntentId?: string;
  title?: string;
  description?: string;
  successMessage?: string;
  errorMessage?: string;
}

export const ThreeDSecurePopup: React.FC<ThreeDSecurePopupProps> = ({
  isOpen,
  onClose: _onClose,
  onSuccess,
  onError,
  clientSecret,
  paymentIntentId,
  title = "Card Authentication",
  description = "Your bank requires additional verification for this transaction.",
  successMessage = "Your card has been verified successfully.",
  errorMessage = "Please try again or use a different payment method."
}) => {
  return (
    <Popup variant="custom" title={title} open={isOpen} enableCloseOnBackdropClick={false} hideCloseButton maxWidth="sm" actions={[]}>
      <ThreeDSecureModal
        clientSecret={clientSecret}
        paymentIntentId={paymentIntentId}
        onSuccess={onSuccess}
        onError={onError}
        title={title}
        description={description}
        successMessage={successMessage}
        errorMessage={errorMessage}
        hideTitle={true}
      />
    </Popup>
  );
};
