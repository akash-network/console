"use client";
import React, { ReactNode } from "react";
import { WalletStatus } from "../layout/WalletStatus";
import { Title } from "./Title";

type Props = {
  text: string | ReactNode;
  children?: ReactNode;
};

export const ConnectWallet: React.FunctionComponent<Props> = ({ text }) => {
  return (
    <div className="mx-auto max-w-[350px] text-center">
      <Title className="mb-4 text-center !text-xl">{text}</Title>
      <WalletStatus />
    </div>
  );
};
