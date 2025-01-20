"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";
import { Layout } from "../layout/Layout";
import { WelcomePanel } from "./WelcomePanel";

export const HomeContainer: React.FC = () => {
  const router = useRouter();
  const { isWalletConnected, isProvider, isProviderStatusFetched } = useWallet();
  const [isLoading] = useState(false);

  useEffect(() => {
    if (isWalletConnected && isProviderStatusFetched && isProvider) {
      router.push("/dashboard");
    }
  }, [isWalletConnected, isProvider, router, isProviderStatusFetched]);

  return (
    <Layout containerClassName="flex h-full flex-col justify-between" isLoading={isWalletConnected && (!isProviderStatusFetched || isLoading)}>
      <WelcomePanel />
    </Layout>
  );
};
