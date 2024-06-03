"use client";
import React from "react";

import { cn } from "@src/utils/styleUtils";
import { DropdownMenuIconItem } from "../ui/dropdown-menu";

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
    <DropdownMenuIconItem className={cn("hover:text-primary cursor-pointer", className)} onClick={onClick} icon={icon} ref={ref}>
      {children}
    </DropdownMenuIconItem>
  );
});
