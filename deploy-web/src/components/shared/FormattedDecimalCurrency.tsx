import { makeStyles } from "tss-react/mui";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { FormattedNumberParts } from "react-intl";
import { Box, useTheme } from "@mui/material";
import React from "react";

type Props = {
  value: number;
  precision?: number;
  style?: "currency" | "unit" | "decimal" | "percent";
  currency?: string;
};

export const FormattedDecimalCurrency: React.FunctionComponent<Props> = ({ value, precision = 6, style, currency }) => {
  const theme = useTheme();

  return (
    <FormattedNumberParts value={value} maximumFractionDigits={precision} minimumFractionDigits={precision} style={style} currency={currency}>
      {parts => (
        <Box sx={{ display: "inline-flex", alignItems: "flex-start" }}>
          {parts.map((part, i) => {
            switch (part.type) {
              case "currency":
                return (
                  <Box key={i} component="span" sx={{ fontSize: "1rem", alignSelf: "center", marginRight: ".25rem", marginTop: "-.5rem" }}>
                    {part.value}
                  </Box>
                );

              default:
                return <React.Fragment key={i}>{part.value}</React.Fragment>;
            }
          })}
        </Box>
      )}
    </FormattedNumberParts>
  );
};
