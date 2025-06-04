import React from "react";
import { Popup } from "@akashnetwork/ui/components";

interface DeletePaymentMethodPopupProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isRemovingPaymentMethod: boolean;
}

export const DeletePaymentMethodPopup: React.FC<DeletePaymentMethodPopupProps> = ({ open, onClose, onConfirm, isRemovingPaymentMethod }) => {
  return (
    <Popup
      open={open}
      onClose={onClose}
      title="Remove Payment Method"
      variant="custom"
      actions={[
        {
          label: "Cancel",
          onClick: onClose,
          side: "left"
        },
        {
          label: "Remove",
          onClick: onConfirm,
          variant: "destructive",
          disabled: isRemovingPaymentMethod,
          side: "right"
        }
      ]}
    >
      <p>Are you sure you want to remove this payment method? This action cannot be undone.</p>
    </Popup>
  );
};
