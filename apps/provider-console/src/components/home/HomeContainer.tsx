"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import networkStore from "@src/store/networkStore";
import { useAtomValue } from "jotai";
import restClient from "@src/utils/restClient";
import { WalletNotConnected } from "./WalletNotConnected";
import { NotAProvider } from "./NotAProvider";
import { Button, Spinner } from "@akashnetwork/ui/components";
import ProviderActionList from "../shared/ProviderActionList";
import { useAtom } from "jotai";
import providerProcessStore from "@src/store/providerProcessStore";

export function HomeContainer() {
  const [, resetProcess] = useAtom(providerProcessStore.resetProviderProcess);
  const router = useRouter();
  const { isWalletConnected, isWalletArbitrarySigned, isProvider, isOnline, isProviderStatusFetched } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [, setProvider] = useState<any>(null);
  const [actions, setActions] = useState<any>(null);
  const selectedNetwork = useAtomValue(networkStore.selectedNetwork); // or similar method to get the value
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isProvider && isOnline) {
      setIsLoading(true);
      fetchActions();
    }
    console.log("isProviderStatusFetched", isWalletArbitrarySigned);
  }, [isProvider, isOnline, isWalletArbitrarySigned]);

  const fetchActions = async () => {
    try {
      const actionsResponse: any = await restClient.get(`/actions`);
      setActions(actionsResponse.actions);
    } catch (error) {
      setLoadingMessage("Error fetching actions");
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
    <Layout containerClassName="flex h-full flex-col justify-between" isLoading={!isProviderStatusFetched || isLoading}>
      <div className="flex flex-grow items-center justify-center">
        <div className="mb-4">
          {(!isProviderStatusFetched || isLoading) && isWalletConnected ? (
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
    </Layout>
  );
}
