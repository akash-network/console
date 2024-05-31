import { SxProps, Theme } from "@mui/material";
import Container from "@mui/material/Container";
import { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  sx?: SxProps<Theme>;
};

export const PageContainer: React.FunctionComponent<Props> = ({ children, sx = {} }) => {
  return <Container sx={{ paddingTop: { xs: "1rem", sm: "2rem" }, paddingBottom: "2rem", ...sx }}>{children}</Container>;
};

export default PageContainer;
