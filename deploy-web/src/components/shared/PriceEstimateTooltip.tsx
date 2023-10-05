import { PriceValue } from "./PriceValue";
import InfoIcon from "@mui/icons-material/Info";
import { averageBlockTime, getAvgCostPerMonth } from "@src/utils/priceUtils";
import { averageDaysInMonth } from "@src/utils/dateUtils";
import { Box, Typography } from "@mui/material";
import { CustomTooltip } from "./CustomTooltip";
import { makeStyles } from "tss-react/mui";
import { ReactNode } from "react";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { useDenomData } from "@src/hooks/useWalletBalance";

type Props = {
  value: number | string;
  denom: string;
  children?: ReactNode;
};

const useStyles = makeStyles()(theme => ({
  tooltipIcon: {
    marginLeft: ".5rem",
    fontSize: "1rem",
    color: theme.palette.text.secondary
  }
}));

export const PriceEstimateTooltip: React.FunctionComponent<Props> = ({ value, denom }) => {
  const { classes } = useStyles();
  const _value = udenomToDenom(typeof value === "string" ? parseFloat(value) : value, 10);
  const perDayValue = _value * (60 / averageBlockTime) * 60 * 24;
  const perMonthValue = _value * (60 / averageBlockTime) * 60 * 24 * averageDaysInMonth;
  const denomData = useDenomData(denom);

  return (
    <CustomTooltip
      arrow
      title={
        <Box>
          <Typography variant="caption">Price estimation:</Typography>
          <div>
            <strong>
              <PriceValue value={_value} denom={denom} />
            </strong>
            &nbsp; per block (~{averageBlockTime}sec.)
          </div>

          <div>
            <strong>
              <PriceValue value={perDayValue} denom={denom} />
            </strong>
            &nbsp; per day
          </div>

          <div>
            <strong>
              <PriceValue value={perMonthValue} denom={denom} />
            </strong>
            &nbsp; per month
          </div>

          <Box sx={{ fontSize: ".7rem", marginTop: ".5rem" }}>({`~${udenomToDenom(getAvgCostPerMonth(value as number))} ${denomData?.label}/month`})</Box>
        </Box>
      }
    >
      <InfoIcon className={classes.tooltipIcon} fontSize="small" />
    </CustomTooltip>
  );
};
