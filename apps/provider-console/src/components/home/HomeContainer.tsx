"use client";
import React, { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";
import { useProviderActions } from "@src/queries/useProviderQuery";
import { Layout } from "../layout/Layout";
import { ProviderActionList } from "../shared/ProviderActionList";
import { WelcomePanel } from "./WelcomePanel";

export const HomeContainer: React.FC = () => {
  const router = useRouter();
  const { isWalletConnected, isProvider, isOnline, isProviderStatusFetched } = useWallet();
  const [isLoading] = useState(false);
  const { data: providerActions } = useProviderActions();

  useEffect(() => {
    if (isWalletConnected && isProvider) {
      router.push("/dashboard");
    }
  }, [isWalletConnected, isProvider, isOnline, providerActions, router]);

  return (
    <Layout containerClassName="flex h-full flex-col justify-between" isLoading={!isProviderStatusFetched || isLoading}>
      {!isWalletConnected || (isWalletConnected && !isProvider && (!providerActions || providerActions.length === 0)) ? <WelcomePanel /> : null}
      <div className="flex flex-grow items-center justify-center mt-5">
        <div className="mb-4">
          {(!isProviderStatusFetched || isLoading) && isWalletConnected ? (
            <div className="flex flex-col items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
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
