"use client";
import type { ReactNode } from "react";
import React, { useState } from "react";
import { Copy } from "iconoir-react";
import { useSnackbar } from "notistack";

import { cn, copyTextToClipboard } from "../../utils";
import { CustomTooltip } from "../tooltip";
import { Snackbar } from "./snackbar";

export const shortenAddress = (address: string) => {
  return `${address.slice(0, 8)}...${address.slice(-5)}`;
};

type Props = {
  address: string;
  isCopyable?: boolean;
  disableTruncate?: boolean;
  disableTooltip?: boolean;
  showIcon?: boolean;
  className?: string;
  children?: ReactNode;
};

export const Address: React.FunctionComponent<Props> = ({ address, isCopyable, disableTruncate, disableTooltip, showIcon, className, ...rest }) => {
  const [isOver, setIsOver] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const formattedAddress = disableTruncate ? address : shortenAddress(address);

  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isCopyable) {
      event.preventDefault();
      event.stopPropagation();

      copyTextToClipboard(address);
      enqueueSnackbar(<Snackbar title="Address copied to clipboard!" />, {
        variant: "success",
        autoHideDuration: 2000
      });
    }
  };

  const content = (
    <span
      className={cn("text-primary inline-flex items-center transition-all hover:underline", { ["cursor-pointer"]: isCopyable }, className)}
      onClick={onClick}
      onMouseOver={() => setIsOver(true)}
      onMouseOut={() => setIsOver(false)}
      {...rest}
    >
      <span>{formattedAddress}</span>
      {isCopyable && <Copy className={cn("ml-2 text-xs opacity-0", { ["opacity-100"]: isOver || showIcon })} />}
    </span>
  );

  return disableTruncate || disableTooltip ? content : <CustomTooltip title={address}>{content}</CustomTooltip>;
};
