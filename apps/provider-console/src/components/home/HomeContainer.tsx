"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/router";

import { useProvider } from "@src/context/ProviderContext";
import { useWallet } from "@src/context/WalletProvider";
import { Layout } from "../layout/Layout";
import { WelcomePanel } from "./WelcomePanel";

export const HomeContainer: React.FC = () => {
  const router = useRouter();
  const { isWalletConnected } = useWallet();
  const { providerDetails, isLoadingProviderDetails } = useProvider();

  useEffect(() => {
    if (isWalletConnected && !isLoadingProviderDetails && providerDetails) {
      router.push("/dashboard");
    }
  }, [isWalletConnected, providerDetails, router, isLoadingProviderDetails]);

  return (
    <Layout containerClassName="flex h-full flex-col justify-between" isLoading={isWalletConnected && isLoadingProviderDetails}>
      <WelcomePanel />
    </Layout>
  );
};
