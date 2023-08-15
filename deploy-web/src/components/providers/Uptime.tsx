import { Box, useTheme } from "@mui/material";
import { useIntl } from "react-intl";

type Props = {
  value: number;
};
export const Uptime: React.FunctionComponent<Props> = ({ value }) => {
  const intl = useIntl();
  const theme = useTheme();

  return (
    <Box
      component="span"
      sx={{
        color: value < 0.95 ? theme.palette.warning.main : theme.palette.success.main
      }}
    >
      {intl.formatNumber(value, { style: "percent", maximumFractionDigits: 2 })}
    </Box>
  );
};
