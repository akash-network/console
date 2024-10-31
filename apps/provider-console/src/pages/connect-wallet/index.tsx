"use client";
import React from "react";

import Layout from "@src/components/layout/Layout";
import { ConnectWallet } from "@src/components/shared/ConnectWallet";

const YourAccount: React.FC = () => {
  return (
    <Layout>
      <ConnectWallet text="Connect your wallet to become provider" />
    </Layout>
  );
};

export default YourAccount;
