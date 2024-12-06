import React, { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";

interface WithAuthProps {
  WrappedComponent: React.ComponentType;
  authLevel: "wallet" | "provider" | "onlineProvider";
}

export const withAuth = ({ WrappedComponent, authLevel = "wallet" }: WithAuthProps) => {
  const AuthComponent: React.FC = props => {
    const { isWalletConnected, isProvider, isProviderStatusFetched, isProviderOnlineStatusFetched, isOnline } = useWallet();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Checking wallet connection...");

    useEffect(() => {
      if (authLevel === "wallet") {
        if (!isWalletConnected) {
          setLoadingMessage("Connecting to wallet...");
          router.push("/");
          return;
        }
        setLoading(false);
      }

      if (authLevel === "provider") {
        if (!isWalletConnected) {
          setLoadingMessage("Connecting to wallet...");
          router.push("/");
          return;
        }

        if (!isProviderStatusFetched) {
          setLoadingMessage("Checking provider status...");
          return;
        }

        if (!isProvider) {
          router.push("/");
          return;
        }

        setLoading(false);
      }

      if (authLevel === "onlineProvider") {
        if (!isWalletConnected) {
          setLoadingMessage("Wallet not connected, redirecting to home page...");
          router.push("/");
          return;
        }

        if (!isProviderStatusFetched || !isProviderOnlineStatusFetched) {
          setLoadingMessage("Checking provider status...");
          return;
        }

        if (!isProvider && !isOnline) {
          router.push("/");
          return;
        }
        setLoading(false);
      }
    }, [isWalletConnected, isProvider, isProviderStatusFetched, isProviderOnlineStatusFetched, router, authLevel]);

    if (loading) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            fontSize: "18px",
            color: "#333"
          }}
        >
          <Spinner />
          <p style={{ marginTop: "20px" }}>{loadingMessage}</p>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  return AuthComponent;
};
