"use client";
import React from "react";
import { DropdownMenuIconItem } from "@akashnetwork/ui/components";

import { cn } from "@akashnetwork/ui/utils";

type Props = {
  icon?: string | React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent) => any;
};

export const CustomDropdownLinkItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuIconItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuIconItem> & Props
>(({ onClick, icon, children, className = "", ...rest }, ref) => {
  return (
    <DropdownMenuIconItem className={cn("cursor-pointer hover:text-primary", className)} onClick={onClick} icon={icon} ref={ref} {...rest}>
      {children}
    </DropdownMenuIconItem>
  );
});
