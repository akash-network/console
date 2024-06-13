"use client";
import React from "react";

import { cn } from "@src/utils/styleUtils";
import { DropdownMenuIconItem } from "@akashnetwork/ui/components";

type Props = {
  icon?: string | React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent) => any;
};

export const CustomDropdownLinkItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuIconItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuIconItem> & Props
>(({ onClick, icon, children, className = "" }, ref) => {
  return (
    <DropdownMenuIconItem className={cn("cursor-pointer hover:text-primary", className)} onClick={onClick} icon={icon} ref={ref}>
      {children}
    </DropdownMenuIconItem>
  );
});
