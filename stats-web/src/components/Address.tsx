"use client";
import React, { ReactNode, useState } from "react";
import { useToast } from "./ui/use-toast";
import { copyTextToClipboard } from "@/lib/copyClipboard";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  address: string;
  isCopyable?: boolean;
  disableTruncate?: boolean;
  showIcon?: boolean;
  children?: ReactNode;
};

export const Address: React.FunctionComponent<Props> = ({ address, isCopyable, disableTruncate, showIcon, ...rest }) => {
  const [isOver, setIsOver] = useState(false);
  const { toast } = useToast();
  let formattedAddress = disableTruncate ? address : [address?.slice(0, 8), "...", address?.slice(address?.length - 5)].join("");

  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isCopyable) {
      event.preventDefault();
      event.stopPropagation();

      copyTextToClipboard(address);
      toast({
        title: "Address copied to clipboard!",
        variant: "success"
      });
    }
  };

  const content = (
    <span
      className={cn("inline-flex items-center text-primary transition-all hover:underline", { ["cursor-pointer"]: isCopyable })}
      onClick={onClick}
      onMouseOver={() => setIsOver(true)}
      onMouseOut={() => setIsOver(false)}
      {...rest}
    >
      <span>{formattedAddress}</span>
      {isCopyable && <Copy size="1rem" className={cn("ml-2 opacity-0", { ["opacity-100"]: isOver || showIcon })} />}
    </span>
  );

  return disableTruncate ? (
    content
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{address}</TooltipContent>
    </Tooltip>
  );
};
