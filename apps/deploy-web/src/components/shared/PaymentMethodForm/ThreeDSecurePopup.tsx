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
  paymentMethodId?: string;
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
  paymentMethodId,
  title = "Quick Verification",
  description = "Your bank needs a quick confirmation — this usually takes less than 30 seconds.",
  successMessage = "Verified! Setting up your free trial...",
  errorMessage = "Verification didn't go through. Please try again or use a different card."
}) => {
  return (
    <Popup variant="custom" title={title} open={isOpen} enableCloseOnBackdropClick={false} hideCloseButton maxWidth="sm" actions={[]}>
      <ThreeDSecureModal
        clientSecret={clientSecret}
        paymentIntentId={paymentIntentId}
        paymentMethodId={paymentMethodId}
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
