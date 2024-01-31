import { cn } from "@src/utils/styleUtils";
import React from "react";

// const useStyles = makeStyles()(theme => ({
//   root: {
//     backgroundColor: "transparent",
//     border: "none",
//     cursor: "pointer",
//     textDecoration: "underline",
//     display: "inline-flex",
//     margin: 0,
//     padding: 0,
//     color: theme.palette.secondary.main,
//     "&:visited": {
//       color: theme.palette.secondary.dark
//     },
//     "&:disabled": {
//       color: theme.palette.grey[500],
//       cursor: "initial"
//     }
//   }
// }));

export function LinkTo({ children, className = "", ...rest }: React.PropsWithChildren<{ className?: string } & React.ButtonHTMLAttributes<{}>>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        className,
        "visited:text-primary-visited m-0 inline-flex cursor-pointer border-0 bg-transparent p-0 text-primary underline disabled:cursor-default disabled:text-gray-500"
      )}
    >
      {children}
    </button>
  );
}
