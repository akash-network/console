"use client";
import React, { ReactNode } from "react";
import { WalletStatus } from "../layout/WalletStatus";

type Props = {
  text: string | ReactNode;
  children?: ReactNode;
};

export const ConnectWallet: React.FunctionComponent<Props> = ({ text }) => {
  return (
    <div className="mx-auto max-w-[350px] text-center">
      <h1 className="mb-4 text-center text-2xl font-bold">{text}</h1>
      <WalletStatus />
    </div>
  );
};
