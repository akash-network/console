"use client";

import { cn } from "@src/utils/styleUtils";
import { ArrowDown } from "iconoir-react";

interface ExpandMoreProps {
  expand: boolean;
  className?: string;
}

// export const ExpandMore = styled((props: ExpandMoreProps) => {
//   const { expand, ...other } = props;
//   return <ExpandMoreIcon {...other} />;
// })(({ theme, expand }) => ({
//   transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
//   marginLeft: "auto",
//   transition: theme.transitions.create("transform", {
//     duration: theme.transitions.duration.shortest
//   })
// }));

export const ExpandMore = ({ expand, className }: ExpandMoreProps) => {
  return <ArrowDown className={cn(className, "transition-all", { ["rotate-180"]: expand })} />;
};
