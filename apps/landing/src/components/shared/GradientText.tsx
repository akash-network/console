import { ReactNode } from "react";
import { Box, SxProps, Theme } from "@mui/material";

import { burningGradientStyle } from "@src/utils/colors";

type Props = {
  children?: ReactNode;
  sx?: SxProps<Theme>;
};

export const GradientText: React.FunctionComponent<Props> = ({ children, sx = {} }) => {
  return (
    <Box component="span" sx={{ ...burningGradientStyle, display: "inline-block", ...sx }}>
      {children}
    </Box>
  );
};
