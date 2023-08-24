import { AktPriceValue } from "./PriceValue";
import InfoIcon from "@mui/icons-material/Info";
import { averageBlockTime, getAvgCostPerMonth, uaktToAKT } from "@src/utils/priceUtils";
import { averageDaysInMonth } from "@src/utils/dateUtils";
import { Box, Typography } from "@mui/material";
import { CustomTooltip } from "./CustomTooltip";
import { makeStyles } from "tss-react/mui";
import { ReactNode } from "react";

type Props = {
  value: number | string;
  children?: ReactNode;
};

const useStyles = makeStyles()(theme => ({
  tooltipIcon: {
    marginLeft: ".5rem",
    fontSize: "1rem",
    color: theme.palette.text.secondary
  }
}));

export const PriceEstimateTooltip: React.FunctionComponent<Props> = ({ value }) => {
  const { classes } = useStyles();
  const _value = uaktToAKT(typeof value === "string" ? parseFloat(value) : value, 6);

  return (
    <CustomTooltip
      arrow
      title={
        <Box>
          <Typography variant="caption">Price estimation:</Typography>
          <div>
            <strong>
              <AktPriceValue value={_value} />
            </strong>
            &nbsp; per block (~{averageBlockTime}sec.)
          </div>

          <div>
            <strong>
              <AktPriceValue value={_value * (60 / averageBlockTime) * 60 * 24} />
            </strong>
            &nbsp; per day
          </div>

          <div>
            <strong>
              <AktPriceValue value={_value * (60 / averageBlockTime) * 60 * 24 * averageDaysInMonth} />
            </strong>
            &nbsp; per month
          </div>

          <Box sx={{ fontSize: ".7rem", marginTop: ".5rem" }}>({`~${uaktToAKT(getAvgCostPerMonth(value))}akt/month`})</Box>
        </Box>
      }
    >
      <InfoIcon className={classes.tooltipIcon} fontSize="small" />
    </CustomTooltip>
  );
};
