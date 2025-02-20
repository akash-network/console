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

    const delayedRedirect = (message: string) => {
      setLoadingMessage(message);
      return new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
    };

    const delayedCheck = (message: string) => {
      setLoadingMessage(message);
      return new Promise(resolve => setTimeout(resolve, 5000)); // 3 second delay
    };

    useEffect(() => {
      const checkAuth = async () => {
        // Wait for initial wallet connection check
        while (!isWalletConnected) {
          await delayedCheck("Checking wallet connection...");
          if (!isWalletConnected) continue;
        }

        if (authLevel === "wallet") {
          if (!isWalletConnected) {
            await delayedRedirect("Wallet not connected, redirecting to home page...");
            router.push("/");
            return;
          }
          setLoading(false);
        }

        if (authLevel === "provider") {
          if (!isWalletConnected) {
            await delayedRedirect("Wallet not connected, redirecting to home page...");
            router.push("/");
            return;
          }

          if (!isProviderStatusFetched) {
            setLoadingMessage("Checking provider status...");
            return;
          }

          if (!isProvider) {
            await delayedRedirect("Not a provider, redirecting to home page...");
            router.push("/");
            return;
          }

          setLoading(false);
        }

        if (authLevel === "onlineProvider") {
          if (!isWalletConnected) {
            await delayedRedirect("Wallet not connected, redirecting to home page...");
            router.push("/");
            return;
          }

          if (!isProviderStatusFetched || !isProviderOnlineStatusFetched) {
            setLoadingMessage("Checking provider status...");
            return;
          }

          if (!isProvider && !isOnline) {
            await delayedRedirect("Provider is offline, redirecting to home page...");
            router.push("/");
            return;
          }
          setLoading(false);
        }
      };

      checkAuth();
    }, [isWalletConnected, isProvider, isProviderStatusFetched, isProviderOnlineStatusFetched, isOnline, router]);

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
