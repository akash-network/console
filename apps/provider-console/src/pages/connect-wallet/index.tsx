"use client";
import React, { useEffect, useState } from "react";

import Layout from "@src/components/layout/Layout";
import { useRouter } from "next/router";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { ConnectWallet } from "@src/components/shared/ConnectWallet";

const YourAccount: React.FunctionComponent = () => {
  const { isWalletConnected, wallet } = useSelectedChain();
  const router = useRouter();

  // useEffect(() => {
  //   if (isWalletConnected) {
  //     const returnUrl = localStorage.getItem("returnUrl") || "/";
  //     localStorage.removeItem("returnUrl"); // Clear the stored URL
  //     // router.push(returnUrl);
  //   }
  // }, []);

  return (
    <Layout>
      <ConnectWallet text="Connect your wallet to become provider" />
    </Layout>
  );
};

export default YourAccount;
