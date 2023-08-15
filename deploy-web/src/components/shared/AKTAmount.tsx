import { makeStyles } from "tss-react/mui";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { FormattedNumber, FormattedNumberParts } from "react-intl";
import { Box, useTheme } from "@mui/material";
import React from "react";
import { usePricing } from "@src/context/PricingProvider";
import { AKTLabel } from "./AKTLabel";

type Props = {
  uakt: number;
  showAKTLabel?: boolean;
  showUSD?: boolean;
};

export const AKTAmount: React.FunctionComponent<Props> = ({ uakt, showUSD, showAKTLabel }) => {
  const theme = useTheme();
  const { isLoaded: isPriceLoaded, aktToUSD } = usePricing();

  const aktAmount = udenomToDenom(uakt, 6);

  return (
    <>
      <FormattedNumberParts value={aktAmount} maximumFractionDigits={6} minimumFractionDigits={6}>
        {parts => (
          <>
            {parts.map((part, i) => {
              switch (part.type) {
                case "integer":
                case "group":
                  return <b key={i}>{part.value}</b>;

                case "decimal":
                case "fraction":
                  return (
                    <Box key={i} component="small" sx={{ color: theme.palette.mode === "dark" ? theme.palette.grey[400] : theme.palette.grey[800] }}>
                      {part.value}
                    </Box>
                  );

                default:
                  return <React.Fragment key={i}>{part.value}</React.Fragment>;
              }
            })}
          </>
        )}
      </FormattedNumberParts>
      {showAKTLabel && (
        <>
          &nbsp;
          <AKTLabel />
        </>
      )}
      {isPriceLoaded && showUSD && aktAmount > 0 && (
        <Box component="small" sx={{ color: theme.palette.mode === "dark" ? theme.palette.grey[400] : theme.palette.grey[800] }}>
          &nbsp;(
          <FormattedNumber style="currency" currency="USD" value={aktToUSD(aktAmount)} />)
        </Box>
      )}
    </>
  );
};
