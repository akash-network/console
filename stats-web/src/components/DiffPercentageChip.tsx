import React from "react";
import { FormattedNumber } from "react-intl";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "./ui/badge";
// import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
// import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

// import { makeStyles } from "tss-react/mui";
// import Chip from "@mui/material/Chip";
// import { cx } from "@emotion/css";
// import { customColors } from "@src/utils/colors";

export interface DiffPercentageChipProps {
  value: number;
  size?: "small" | "medium";
}

// const useStyles = makeStyles()(theme => ({
//   root: {
//     marginLeft: ".5rem",
//     fontWeight: 700
//   },
//   small: {
//     fontSize: ".7rem",
//     height: "1rem"
//   },
//   medium: {
//     fontSize: ".8rem",
//     height: "1.2rem"
//   },
//   green: {
//     backgroundColor: customColors.green,
//     color: theme.palette.primary.main,
//     "& .MuiChip-icon": {
//       color: theme.palette.primary.main
//     }
//   },
//   red: {
//     backgroundColor: "transparent",
//     color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[700]
//   },
//   label: {
//     paddingLeft: "4px"
//   }
// }));

export const DiffPercentageChip: React.FunctionComponent<DiffPercentageChipProps> = ({ value, size = "small" }) => {
  if (typeof value !== "number") return null;

  const isPositiveDiff = value >= 0;

  return (
    <Badge
      // size={size}
      // className={cx(
      //   {
      //     [classes.green]: isPositiveDiff,
      //     [classes.red]: !isPositiveDiff,
      //     [classes.small]: size === "small",
      //     [classes.medium]: size === "medium"
      //   },
      //   classes.root
      // )}
      // classes={{ label: classes.label }}
      variant="default"
      // icon={isPositiveDiff ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
      // label={<FormattedNumber style="percent" maximumFractionDigits={2} value={Math.abs(value)} />}
    >
      <span className="flex align-middle">
        {isPositiveDiff ? <ArrowUp /> : <ArrowDown />}
        <FormattedNumber style="percent" maximumFractionDigits={2} value={Math.abs(value)} />
      </span>
    </Badge>
  );
};
