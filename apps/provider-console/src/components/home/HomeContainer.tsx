"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";
import { useProviderActions } from "@src/queries/useProviderQuery";
import { Layout } from "../layout/Layout";
import { WelcomePanel } from "./WelcomePanel";

export const HomeContainer: React.FC = () => {
  const router = useRouter();
  const { isWalletConnected, isProvider, isOnline, isProviderStatusFetched } = useWallet();
  const [isLoading] = useState(false);
  const { data: providerActions } = useProviderActions();

  useEffect(() => {
    if (isWalletConnected && isProvider) {
      router.push("/dashboard");
    }
  }, [isWalletConnected, isProvider, isOnline, providerActions, router]);

  return (
    <Layout containerClassName="flex h-full flex-col justify-between" isLoading={isWalletConnected && (!isProviderStatusFetched || isLoading)}>
      <WelcomePanel />
    </Layout>
  );
};
