import { useMediaQuery, useTheme } from "@mui/material";
import { bannerHeight, bannerHeightSm } from "@src/utils/constants";

export const useBannerHeight = () => {
  const theme = useTheme();
  const smallScreen = useMediaQuery(theme.breakpoints.down("lg"));

  return smallScreen ? bannerHeightSm : bannerHeight;
};
