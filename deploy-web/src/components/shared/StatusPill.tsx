"use client";
import { cn } from "@src/utils/styleUtils";
import { CSSProperties } from "react";

// const useStyles = makeStyles()(theme => ({
//   root: {
//     borderRadius: "1rem"
//   },
//   small: {
//     marginLeft: ".5rem",
//     width: ".5rem",
//     height: ".5rem"
//   },
//   medium: {
//     marginLeft: "1rem",
//     width: ".9rem",
//     height: ".9rem"
//   },
//   statusActive: {
//     backgroundColor: theme.palette.success.dark
//   },
//   statusClosed: {
//     backgroundColor: theme.palette.error.main
//   }
// }));

type Props = {
  state: "active" | "closed" | string;
  style?: CSSProperties;
  size?: "small" | "medium";
  className?: string;
};

export const StatusPill: React.FunctionComponent<Props> = ({ state, style, size = "medium", className = "" }) => {
  return (
    <div
      style={style}
      className={cn(className, "rounded-2xl", {
        ["ml-2 h-2 w-2"]: size === "small",
        ["ml-4 h-4 w-4"]: size === "medium",
        ["bg-green-600"]: state === "active",
        ["bg-destructive"]: state === "closed"
      })}
    />
  );
};
