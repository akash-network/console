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
          variant: "ghost",
          onClick: onClose,
          side: "left"
        },
        {
          label: "Remove",
          onClick: onConfirm,
          variant: "default",
          disabled: isRemovingPaymentMethod,
          side: "right"
        }
      ]}
    >
      <p>Are you sure you want to remove this payment method?</p>
    </Popup>
  );
};
