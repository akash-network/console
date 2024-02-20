// import { styled, Tooltip, tooltipClasses, TooltipProps } from "@mui/material";

import { cn } from "@src/utils/styleUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

// export const CustomTooltip = styled(({ className, ...props }: TooltipProps) => (
//   <Tooltip enterDelay={0} enterTouchDelay={0} {...props} classes={{ popper: className }} />
// ))(({ theme }) => ({
//   [`& .${tooltipClasses.tooltip}`]: {
//     backgroundColor: theme.palette.mode === "dark" ? theme.palette.primary.light : theme.palette.grey[200],
//     color: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main,
//     fontSize: ".9rem"
//   },
//   [`& .${tooltipClasses.arrow}`]: {
//     color: theme.palette.mode === "dark" ? theme.palette.primary.light : theme.palette.grey[200]
//   }
// }));

export function CustomTooltip({ children, className = "", title }: React.PropsWithChildren<{ className?: string; title: string | React.ReactNode }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className={cn(className, "max-w-md z-[500]")}>{title}</TooltipContent>
    </Tooltip>
  );
}
