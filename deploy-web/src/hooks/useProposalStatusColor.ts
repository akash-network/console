import { useTheme } from "@mui/material";

export const useProposalStatusColor = (status: string) => {
  const theme = useTheme();

  switch (status) {
    case "PASSED":
      return theme.palette.success.main;
    case "REJECTED":
      return theme.palette.error.main;
    case "DEPOSIT PERIOD":
    case "VOTING PERIOD":
      return theme.palette.info.main;
    case "UNSPECIFIED":
    case "FAILED":
      return theme.palette.grey[500];

    default:
      return theme.palette.grey[500];
  }
};
