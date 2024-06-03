"use client";
import React from "react";

import { MustConnect } from "./MustConnect";
import { Popup } from "./Popup";

export type Props = {
  message: string;
  onClose: () => void;
};

export const MustConnectModal: React.FunctionComponent<Props> = ({ onClose, message }) => {
  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title="Create an account!"
      actions={[
        {
          label: "Cancel",
          color: "primary",
          variant: "text",
          side: "right",
          onClick: onClose
        }
      ]}
      onClose={onClose}
      maxWidth="xs"
      enableCloseOnBackdropClick
    >
      <MustConnect message={message} />
    </Popup>
  );
};
