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

export const FormattedDecimal: React.FunctionComponent<Props> = ({ value, precision = 6, style, currency }) => {
  const theme = useTheme();

  return (
    <FormattedNumberParts value={value} maximumFractionDigits={precision} minimumFractionDigits={precision} style={style} currency={currency}>
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
  );
};
