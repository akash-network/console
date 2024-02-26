"use client";
import { cn } from "@src/utils/styleUtils";
import { useTheme } from "next-themes";
import { ReactNode } from "react";

// const useStyles = makeStyles()(theme => ({
//   root: { display: "flex", alignItems: "center" },
//   label: {
//     fontWeight: "bold",
//     color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.primary.main,
//     fontSize: ".9rem"
//   },
//   value: {
//     display: "flex",
//     alignItems: "center",
//     marginLeft: ".5rem",
//     fontSize: ".9rem"
//   }
// }));

type Props = {
  label: string;
  value?: string | ReactNode;
  children?: ReactNode;
};

export const LabelValueOld: React.FunctionComponent<Props> = ({ label, value, ...rest }) => {
  const { theme } = useTheme();
  return (
    <div className="flex items-center" {...rest}>
      <label className={cn("font-bold", { ["text-grey-500"]: theme === "dark" })}>{label}</label>
      {value && <div className="ml-2 flex items-center text-sm">{value}</div>}
    </div>
  );
};
