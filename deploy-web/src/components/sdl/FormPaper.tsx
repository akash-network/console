import { Paper, styled } from "@mui/material";

export const FormPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : theme.palette.grey[100]
}));
