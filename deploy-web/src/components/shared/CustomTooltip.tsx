import { cn } from "@src/utils/styleUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export function CustomTooltip({ children, className = "", title }: React.PropsWithChildren<{ className?: string; title: string | React.ReactNode }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className={cn(className, "z-[500] max-w-md")}>{title}</TooltipContent>
    </Tooltip>
  );
}

export function CustomNoDivTooltip({ children, className = "", title }: React.PropsWithChildren<{ className?: string; title: string | React.ReactNode }>) {
  return (
    <TooltipPrimitive.Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>

      <TooltipPrimitive.Portal>
        <TooltipContent className={cn(className, "z-[500] max-w-md")}>{title}</TooltipContent>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Tooltip>
  );
}
