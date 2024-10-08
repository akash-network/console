"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { Footer } from "@src/components/layout/Footer";
import Layout from "../layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import { Card } from "@akashnetwork/ui/components";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import networkStore from "@src/store/networkStore";
import { useAtomValue } from "jotai";
import restClient from "@src/utils/restClient";
import { ProviderProcess } from "../become-provider/ProviderProcess";

export function HomeContainer() {
  const router = useRouter();
  const { isWalletConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [providerStatus, setProviderStatus] = useState<any>(null);
  const selectedNetwork = useAtomValue(networkStore.selectedNetwork); // or similar method to get the value

  useEffect(() => {
    if (isWalletConnected) {
      setIsLoading(true);
      fetchProviderStatus();
    }
  }, [isWalletConnected]);

  const fetchProviderStatus = async () => {
    try {
      const response = await restClient.get(`/provider/status?chainid=${selectedNetwork.chainId}`);
      console.log(response);
      setProviderStatus(response.data);
      // setProviderStatus(response);
    } catch (error) {
      console.error("Failed to fetch provider status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (providerStatus) {
      console.log(providerStatus);
      const { provider, online, job_id } = providerStatus.data;
      if (job_id) {
        // Render ProviderProcess component
      } else if (!provider) {
        // Show become provider card
      } else if (!online) {
        router.push("/remedies");
      } else {
        router.push("/dashboard");
      }
    }
  }, [providerStatus, router]);

  return (
    <Layout containerClassName="flex h-full flex-col justify-between" isLoading={isLoading}>
      <div>
        <div className="mb-4">
          {!isWalletConnected && (
            <Card className="mt-4 p-4">
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
          )}
          {isWalletConnected && providerStatus && providerStatus.job_id && <ProviderProcess jobId={providerStatus.job_id} />}
          {isWalletConnected && providerStatus && !providerStatus.provider && (
            <div>
              <Card className="mt-4 p-4">
                <h2 className="text-lg font-bold">Become a Provider</h2>
                <p>Join the Akash Network and offer your compute resources.</p>
                <ul className="list-disc pl-5">
                  <li>Earn by leasing your compute power.</li>
                  <li>Utilize a streamlined UI with the Praetor App.</li>
                  <li>Access detailed provider documentation.</li>
                  <li>Monitor provider status and earnings.</li>
                  <li>Participate in a decentralized cloud marketplace.</li>
                  <li>Contribute to a sustainable and open-source ecosystem.</li>
                  <li>Gain exposure to a global network of developers and businesses.</li>
                  <li>Benefit from low operational costs and high scalability.</li>
                </ul>
                <div>
                  <button onClick={() => router.push("/become-provider")} className="bg-primary mt-4 rounded px-4 py-2 text-white">
                    Become a Provider
                  </button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </Layout>
  );
}
