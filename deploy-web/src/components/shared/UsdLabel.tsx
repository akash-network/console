import { Box } from "@mui/material";

export const USDLabel = () => {
  return (
    <Box component="span" sx={{ marginLeft: ".5rem", fontSize: ".75rem", fontWeight: 300 }}>
      $USD
    </Box>
  );
};

export const USDCLabel = () => {
  return (
    <Box component="span" sx={{ marginLeft: ".5rem", fontSize: ".75rem", fontWeight: 300 }}>
      USDC
    </Box>
  );
};
