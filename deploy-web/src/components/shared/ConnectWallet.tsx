"use client";
import React, { ReactNode } from "react";
import { WalletStatus } from "../layout/WalletStatus";

type Props = {
  text: string | ReactNode;
  children?: ReactNode;
};

export const ConnectWallet: React.FunctionComponent<Props> = ({ text }) => {
  return (
    <div
      className="mx-auto max-w-[350px] text-center"
      // sx={{ maxWidth: "350px", margin: "0 auto", textAlign: "center" }}
    >
      <h1
        className="mb-4 text-2xl font-bold"
        // sx={{ fontSize: "1.2rem", marginBottom: "1rem", textAlign: "center" }}
      >
        {text}
      </h1>
      <WalletStatus />
    </div>
  );
};
