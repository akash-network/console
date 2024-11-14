"use client";
import React from "react";
import { Card } from "@akashnetwork/ui/components";

import { ConnectWalletButton } from "../wallet/ConnectWalletButton";

export function WalletNotConnected() {
  return (
    <div>
      <div className="mb-4">
        <Card className="mt-4 p-6">
          <h2 className="text-lg font-bold">Connect Your Wallet</h2>
          <p>To become a provider or access the provider dashboard, you need to connect your wallet.</p>
          <ul className="list-disc pl-5">
            <li>Securely connect your wallet to manage your provider account.</li>
            <li>Access exclusive provider features and tools.</li>
            <li>Ensure your transactions and data are protected.</li>
          </ul>
          <div>
            <ConnectWalletButton className="mt-5 w-full md:w-auto" />
          </div>
        </Card>
      </div>
    </div>
  );
}
