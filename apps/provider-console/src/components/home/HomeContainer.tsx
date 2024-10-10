"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Footer } from "@src/components/layout/Footer";
import Layout from "../layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import networkStore from "@src/store/networkStore";
import { useAtomValue } from "jotai";
import restClient from "@src/utils/restClient";
import { ProviderProcess } from "../become-provider/ProviderProcess";
import { WalletNotConnected } from "./WalletNotConnected";
import { NotAProvider } from "./NotaProvider";
import { Spinner } from "@akashnetwork/ui/components";

export function HomeContainer() {
  const router = useRouter();
  const { isWalletConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [isProvider, setIsProvider] = useState(false);
  const [provider, setProvider] = useState<any>(null);
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

        if (!isOnlineResponse.online) {
          setLoadingMessage("Provider is offline <br/> Getting provider actions...");
          const actionsResponse: any = await restClient.get(`/actions`);
          setActions(actionsResponse.actions);
        }
      }
    } catch (error) {
      setLoadingMessage("Error fetching provider status");
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  };

  useEffect(() => {
    if (isProvider && !isOnline && actions?.length === 0) {
      router.push("/remedies");
    }
  }, [actions, isProvider, isOnline, router]);

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
              {isWalletConnected && !isProvider && <NotAProvider />}
              {isProvider && !isOnline && actions?.length > 0 && <ProviderProcess actionId={actions[0].action_id} />}
              {isProvider && isOnline && <p>Provider is online and ready.</p>}
            </>
          )}
        </div>
      </div>
      <Footer />
    </Layout>
  );
}
