import { Typography } from "@mui/material";
import { averageDaysInMonth } from "@src/utils/dateUtils";
import { averageBlockTime } from "@src/utils/priceUtils";
import { PriceValue } from "./PriceValue";

export const PricePerMonth = ({ perBlockValue, typoVariant = "body1", ...rest }) => {
  //** TODO Type */
  return (
    <Typography variant={typoVariant as any} {...rest}>
      <strong>
        <PriceValue value={perBlockValue * (60 / averageBlockTime) * 60 * 24 * averageDaysInMonth} />
      </strong>{" "}
      / month
    </Typography>
  );
};
