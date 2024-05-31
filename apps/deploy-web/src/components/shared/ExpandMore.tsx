"use client";
import { cn } from "@src/utils/styleUtils";
import { ArrowDown } from "iconoir-react";

interface ExpandMoreProps {
  expand: boolean;
  className?: string;
}

export const ExpandMore = ({ expand, className }: ExpandMoreProps) => {
  return <ArrowDown className={cn(className, "transition-all", { ["rotate-180"]: expand })} />;
};
