"use client";
import React, { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";
import restClient from "@src/utils/restClient";
import { Layout } from "../layout/Layout";
import { ProviderActionList } from "../shared/ProviderActionList";
import { NotAProvider } from "./NotAProvider";
import { WalletNotConnected } from "./WalletNotConnected";

export const HomeContainer: React.FC = () => {
  const router = useRouter();
  const { isWalletConnected, isWalletArbitrarySigned, isProvider, isOnline, isProviderStatusFetched } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [actions, setActions] = useState<any>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetchActions();
  }, [isProvider, isOnline, isWalletArbitrarySigned]);

  const fetchActions = async () => {
    try {
      const actionsResponse: any = await restClient.get(`/actions`);
      setActions(actionsResponse.actions);
    } catch (error) {
      setLoadingMessage("Error fetching actions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isWalletConnected && isProvider) {
      router.push("/dashboard");
    }
  }, [isWalletConnected, isProvider, isOnline, actions, router]);

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
              {isWalletConnected && !isProvider && (!actions || actions.length === 0) && <NotAProvider />}
              {isWalletConnected && !isProvider && actions && actions.length > 0 && (
                <div className="mt-4">
                  <ProviderActionList actions={actions} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};
