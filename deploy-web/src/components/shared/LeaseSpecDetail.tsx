import React from "react";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { FormattedNumber } from "react-intl";
import { SxProps, Theme, Typography } from "@mui/material";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import SpeedIcon from "@mui/icons-material/Speed";
import DeveloperBoardIcon from "@mui/icons-material/DeveloperBoard";

type SpecType = "cpu" | "gpu" | "ram" | "storage";
type Props = {
  type: SpecType;
  value: number | string;
  sx?: SxProps<Theme>;
  iconSize?: "small" | "medium" | "large";
};

export const LeaseSpecDetail: React.FunctionComponent<Props> = ({ value, type, sx = {}, iconSize = "large" }) => {
  const theme = useTheme();

  return (
    <Box sx={{ display: "flex", alignItems: "center", marginBottom: ".2rem", ...sx }}>
      {type === "cpu" && <SpeedIcon sx={{ color: theme.palette.grey[600] }} fontSize={iconSize} />}
      {type === "gpu" && <DeveloperBoardIcon sx={{ color: theme.palette.grey[600] }} fontSize={iconSize} />}
      {type === "ram" && <MemoryIcon sx={{ color: theme.palette.grey[600] }} fontSize={iconSize} />}
      {type === "storage" && <StorageIcon sx={{ color: theme.palette.grey[600] }} fontSize={iconSize} />}

      <Box sx={{ marginLeft: ".5rem" }}>{typeof value === "string" ? value : <FormattedNumber value={value} />}</Box>
      <Box sx={{ color: theme.palette.grey[500], marginLeft: ".5rem" }}>
        <Typography variant="caption">
          {type === "cpu" && "CPU"}
          {type === "gpu" && "GPU"}
          {type === "ram" && "RAM"}
          {type === "storage" && "Disk"}
        </Typography>
      </Box>
    </Box>
  );
};
