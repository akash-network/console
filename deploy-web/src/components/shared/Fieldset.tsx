import { makeStyles } from "tss-react/mui";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { FormattedNumber, FormattedNumberParts } from "react-intl";
import { Box, Paper, Typography, useTheme } from "@mui/material";
import React from "react";
import { usePricing } from "@src/context/PricingProvider";
import { AKTLabel } from "./AKTLabel";
import { customColors } from "@src/utils/colors";

type Props = {
  label: string;
  children: React.ReactNode;
};

export const Fieldset: React.FunctionComponent<Props> = ({ label, children }) => {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        position: "relative",
        marginBottom: "1rem",
        borderRadius: ".25rem"
      }}
    >
      <Box
        sx={{
          padding: ".5rem",
          color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[600]
        }}
      >
        <Typography variant="body1">{label}</Typography>
      </Box>

      <Box sx={{ padding: "1rem" }}>{children}</Box>
    </Paper>
  );
};
