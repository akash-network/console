import { darken, styled, TableHead, TableRow } from "@mui/material";

export const CustomTableRow = styled(TableRow)(({ theme }) => ({
  whiteSpace: "nowrap",
  height: "40px",
  "&:nth-of-type(odd)": {
    backgroundColor: theme.palette.mode === "dark" ? darken(theme.palette.grey[700], 0.5) : theme.palette.action.hover
  },
  "& td": {
    border: "none"
  }
}));

export const CustomTableHeader = styled(TableHead)(({ theme }) => ({
  "& th": {
    textTransform: "uppercase",
    border: "none",
    color: theme.palette.mode === "dark" ? theme.palette.grey[400] : theme.palette.grey[600],
    fontSize: ".75rem"
  }
}));
