import { cn } from "@src/utils/styleUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function CustomTooltip({ children, className = "", title }: React.PropsWithChildren<{ className?: string; title: string | React.ReactNode }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className={cn(className, "z-[500] max-w-md")}>{title}</TooltipContent>
    </Tooltip>
  );
}
