"use client";
import React, { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";
import { useProviderActions } from "@src/queries/useProviderQuery";
import { Layout } from "../layout/Layout";
import { ProviderActionList } from "../shared/ProviderActionList";
import { NotAProvider } from "./NotAProvider";
import { WalletNotConnected } from "./WalletNotConnected";

export const HomeContainer: React.FC = () => {
  const router = useRouter();
  const { isWalletConnected, isWalletArbitrarySigned, isProvider, isOnline, isProviderStatusFetched } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const { data: providerActions } = useProviderActions();

  useEffect(() => {
    setIsLoading(true);
  }, [isProvider, isOnline, isWalletArbitrarySigned]);

  useEffect(() => {
    if (isWalletConnected && isProvider) {
      router.push("/dashboard");
    }
  }, [isWalletConnected, isProvider, isOnline, providerActions, router]);

  return (
    <Layout containerClassName="flex h-full flex-col justify-between" isLoading={!isProviderStatusFetched || isLoading}>
      <div className="flex flex-grow items-center justify-center">
        <div className="mb-4">
          {(!isProviderStatusFetched || isLoading) && isWalletConnected ? (
            <div className="flex flex-col items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              {!isWalletConnected && <WalletNotConnected />}
              {isWalletConnected && !isProvider && (!providerActions || providerActions.length === 0) && <NotAProvider />}
              {isWalletConnected && !isProvider && providerActions && providerActions.length > 0 && (
                <div className="mt-4">
                  <ProviderActionList actions={providerActions} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};
