"use client";
import type { ReactNode } from "react";
import React from "react";

import { WalletStatus } from "../layout/WalletStatus";
import { Title } from "./Title";

type Props = {
  text: string | ReactNode;
  children?: ReactNode;
};

export const ConnectWallet: React.FC<Props> = ({ text }) => {
  return (
    <div className="mx-auto max-w-[400px] text-center">
      <Title className="mb-4 text-center !text-lg" subTitle>
        {text}
      </Title>
      <WalletStatus />
    </div>
  );
};
