"use client";
import React, { ReactNode } from "react";

import { WalletStatus } from "../layout/WalletStatus";
import { Title } from "./Title";
import { useAtom } from "jotai";
import walletStore from "@src/store/walletStore";
import Link from "next/link";
import { cn } from "@akashnetwork/ui/utils";
import { buttonVariants } from "@akashnetwork/ui/components";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  text: string | ReactNode;
  children?: ReactNode;
};

export const ConnectWallet: React.FunctionComponent<Props> = ({ text }) => {
  const [isSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);

  return (
    <div className="mx-auto max-w-[400px] text-center">
      <Title className="mb-4 text-center !text-lg" subTitle>
        {text}
      </Title>
      <div className="flex items-center justify-center gap-2">
        <WalletStatus />
        {isSignedInWithTrial && (
          <Link className={cn(buttonVariants({ variant: "outline" }))} href={UrlService.login()}>
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
};
