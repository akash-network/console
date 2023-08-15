import React from "react";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { Alert } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { Popup } from "./Popup";
import { MustConnect } from "./MustConnect";

export const useStyles = makeStyles()(theme => ({}));

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
