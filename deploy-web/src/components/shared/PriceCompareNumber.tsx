import React from "react";
import { Chip } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { FormattedNumber } from "react-intl";
import { cx } from "@emotion/css";
import { customColors } from "@src/utils/colors";

export const useStyles = makeStyles()(theme => ({
  discountChip: {
    fontWeight: "bold",
    color: theme.palette.primary.dark,
    height: "18px",
    fontSize: ".7rem"
  },
  discountChipGreen: {
    backgroundColor: customColors.green
  }
}));

interface IPriceCompareAmountProps {
  amount: number;
  compareAmount?: number;
}

export const PriceCompareAmount: React.FunctionComponent<IPriceCompareAmountProps> = ({ amount, compareAmount }) => {
  const { classes } = useStyles();

  const discount = (amount - compareAmount) / compareAmount;

  return (
    <>
      <FormattedNumber style="currency" currency="USD" value={amount} />
      {!!compareAmount && (
        <Chip
          sx={{ marginLeft: 1 }}
          className={cx(classes.discountChip, {
            [classes.discountChipGreen]: discount < 0
          })}
          size="small"
          label={<FormattedNumber style="percent" value={discount} maximumFractionDigits={2} />}
        />
      )}
    </>
  );
};

export default PriceCompareAmount;
