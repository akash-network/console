"use client";
import React, { ReactNode, useState } from "react";
import { Copy } from "iconoir-react";
import { useSnackbar } from "notistack";

import { cn, copyTextToClipboard } from "../../utils";
import { CustomTooltip } from "../index";
import { Snackbar } from "./snackbar";

type Props = {
  address: string;
  isCopyable?: boolean;
  disableTruncate?: boolean;
  disableTooltip?: boolean;
  showIcon?: boolean;
  children?: ReactNode;
};

export const Address: React.FunctionComponent<Props> = ({ address, isCopyable, disableTruncate, disableTooltip, showIcon, ...rest }) => {
  const [isOver, setIsOver] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const formattedAddress = disableTruncate ? address : [address?.slice(0, 8), "...", address?.slice(address?.length - 5)].join("");

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
      className={cn("text-primary inline-flex items-center transition-all hover:underline", { ["cursor-pointer"]: isCopyable })}
      onClick={onClick}
      onMouseOver={() => setIsOver(true)}
      onMouseOut={() => setIsOver(false)}
      {...rest}
    >
      <span>{formattedAddress}</span>
      {isCopyable && <Copy className={cn("ml-2 opacity-0 text-xs", { ["opacity-100"]: isOver || showIcon })} />}
    </span>
  );

  return disableTruncate || disableTooltip ? content : <CustomTooltip title={address}>{content}</CustomTooltip>;
};
