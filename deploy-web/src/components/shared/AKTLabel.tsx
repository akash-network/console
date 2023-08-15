import React from "react";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

type Props = {};

export const AKTLabel: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();

  return (
    <Box component="span" sx={{ color: theme.palette.secondary.main }}>
      AKT
    </Box>
  );
};
