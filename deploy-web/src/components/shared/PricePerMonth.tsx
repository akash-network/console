import { Typography, TypographyVariant, TypographyProps } from "@mui/material";
import { averageDaysInMonth } from "@src/utils/dateUtils";
import { averageBlockTime } from "@src/utils/priceUtils";
import { PriceValue } from "./PriceValue";
import { ReactNode } from "react";

interface IProps extends TypographyProps {
  perBlockValue: number;
  denom: string;
  typoVariant?: TypographyVariant;
  children?: ReactNode;
}

export const PricePerMonth: React.FunctionComponent<IProps> = ({ perBlockValue, denom, typoVariant = "body1", ...rest }) => {
  const value = perBlockValue * (60 / averageBlockTime) * 60 * 24 * averageDaysInMonth;
  return (
    <Typography variant={typoVariant} {...rest}>
      <strong>
        <PriceValue value={value} denom={denom} />
      </strong>{" "}
      / month
    </Typography>
  );
};
