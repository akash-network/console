import React, { ReactNode } from "react";
import Box from "@mui/material/Box";
import { Typography } from "@mui/material";
import { WalletStatus } from "../layout/WalletStatus";

type Props = {
  text: string | ReactNode;
  children?: ReactNode;
};

export const ConnectWallet: React.FunctionComponent<Props> = ({ children, text }) => {
  return (
    <Box sx={{ maxWidth: "350px", margin: "0 auto", textAlign: "center" }}>
      <Typography variant="h1" sx={{ fontSize: "1.2rem", marginBottom: "1rem", textAlign: "center" }}>
        {text}
      </Typography>
      <WalletStatus />
    </Box>
  );
};

