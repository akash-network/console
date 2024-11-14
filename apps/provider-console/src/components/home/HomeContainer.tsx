"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import { useProviderActions } from "@src/queries/useProviderQuery";
import { Layout } from "../layout/Layout";
import { ProviderActionList } from "../shared/ProviderActionList";
import { NotAProvider } from "./NotAProvider";
import { WalletNotConnected } from "./WalletNotConnected";
import { NotAProvider } from "./NotAProvider";
import { Button, Spinner } from "@akashnetwork/ui/components";
import ProviderActionList from "../shared/ProviderActionList";
import { useAtom } from "jotai";
import providerProcessStore from "@src/store/providerProcessStore";

export function HomeContainer() {
  const [, resetProcess] = useAtom(providerProcessStore.resetProviderProcess);
  const router = useRouter();
  const { isWalletConnected, isProvider, isOnline, isProviderStatusFetched } = useWallet();
  const [isLoading] = useState(false);
  const { data: providerActions } = useProviderActions();

  useEffect(() => {
    if (isWalletConnected && isProvider) {
      router.push("/dashboard");
    }
  }, [isWalletConnected, isProvider, isOnline, providerActions, router]);

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
              {isWalletConnected && !isProvider && (!actions || actions.length === 0) && <NotAProvider />}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
