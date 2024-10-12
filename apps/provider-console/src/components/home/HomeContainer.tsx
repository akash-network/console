"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Footer } from "@src/components/layout/Footer";
import Layout from "../layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import networkStore from "@src/store/networkStore";
import { useAtomValue } from "jotai";
import restClient from "@src/utils/restClient";
import { WalletNotConnected } from "./WalletNotConnected";
import { NotAProvider } from "./NotAProvider";
import { Button, Spinner } from "@akashnetwork/ui/components";
import { ProviderActionDetails } from "../shared/ProviderActionDetails";
import ProviderActionList from "../shared/ProviderActionList";
import Link from "next/link";
import { useAtom } from "jotai";
import providerProcessStore from "@src/store/providerProcessStore";

export function HomeContainer() {
  const [, resetProcess] = useAtom(providerProcessStore.resetProviderProcess);
  const router = useRouter();
  const { isWalletConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [isProvider, setIsProvider] = useState(false);
  const [, setProvider] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [actions, setActions] = useState<any>(null);
  const selectedNetwork = useAtomValue(networkStore.selectedNetwork); // or similar method to get the value
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isWalletConnected) {
      setIsLoading(true);
      fetchProviderStatus();
    }
  }, [isWalletConnected]);

  const fetchProviderStatus = async () => {
    try {
      setLoadingMessage("Checking provider status...");
      const isProviderResponse: any = await restClient.get(`/provider/status/onchain?chainid=${selectedNetwork.chainId}`);
      setIsProvider(isProviderResponse.provider ? true : false);
      setProvider(isProviderResponse.provider);

      if (isProviderResponse.provider) {
        setLoadingMessage("Provider found, Checking online status...");
        const isOnlineResponse: any = await restClient.get(`/provider/status/online?chainid=${selectedNetwork.chainId}`);
        setIsOnline(isOnlineResponse.online);
      }
      setLoadingMessage("Checking actions...");
      const actionsResponse: any = await restClient.get(`/actions`);
      setActions(actionsResponse.actions);
    } catch (error) {
      setLoadingMessage("Error fetching provider status");
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  };

  useEffect(() => {
    if (isWalletConnected && isProvider) {
      router.push("/dashboard");
    }
  }, [isWalletConnected, isProvider, isOnline, actions, router]);

  const handleBecomeProvider = () => {
    resetProcess();
    router.push("/become-provider");
  };

  return (
    <Layout containerClassName="flex h-full flex-col justify-between" isLoading={isLoading}>
      <div className="flex flex-grow items-center justify-center">
        <div className="mb-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center">
              <Spinner />
              <p className="mt-2">{loadingMessage}</p>
            </div>
          ) : (
            <>
              {!isWalletConnected && <WalletNotConnected />}
              {isWalletConnected && !isProvider && actions && (
                <div className="mt-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">Provider Actions</h2>
                    <Button variant="outline" onClick={handleBecomeProvider}>
                      Become a Provider
                    </Button>
                  </div>
                  <ProviderActionList actions={actions} />
                </div>
              )}
              {isWalletConnected && !isProvider && (!actions || actions.length === 0) && <NotAProvider />}
            </>
          )}
        </div>
      </div>
      <Footer />
    </Layout>
  );
}
