import React, { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { useProvider } from "@src/context/ProviderContext";
import { useWallet } from "@src/context/WalletProvider";

interface WithAuthProps {
  WrappedComponent: React.ComponentType;
  authLevel: "wallet" | "provider";
}

export const withAuth = ({ WrappedComponent, authLevel = "wallet" }: WithAuthProps) => {
  const AuthComponent: React.FC = props => {
    const { isWalletConnected } = useWallet();
    const { providerDetails, isLoadingProviderDetails } = useProvider();
    const { isOnline, isLoadingOnlineStatus } = useProvider();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Checking wallet connection...");
    const [walletCheckCount, setWalletCheckCount] = useState(0);

    useEffect(() => {
      let isMounted = true;

      const checkAuth = async () => {
        if (!isMounted) return;

        if (!isWalletConnected) {
          if (walletCheckCount >= 3) {
            setLoadingMessage("Wallet not connected, redirecting to home page...");
            setTimeout(() => {
              if (isMounted) router.push("/");
            }, 2000);
            return;
          }

          setWalletCheckCount(prev => prev + 1);
          setLoadingMessage("Checking wallet connection...");
          return;
        }

        // Reset wallet check count when wallet is connected
        if (walletCheckCount > 0) {
          setWalletCheckCount(0);
        }

        if (authLevel === "wallet") {
          setLoading(false);
          return;
        }

        if (isLoadingProviderDetails) {
          setLoadingMessage("Checking provider...");
          return;
        }

        const isAuthorized = authLevel === "provider" ? !!providerDetails : true;

        // const isAuthorized = authLevel === "provider" ? providerDetails : providerDetails || isOnline;

        if (!isAuthorized) {
          const message = authLevel === "provider" ? "Not a provider, redirecting to home page..." : "Provider is offline, redirecting to home page...";
          setLoadingMessage(message);
          setTimeout(() => {
            if (isMounted) router.push("/");
          }, 2000);
          return;
        }

        setLoading(false);
      };

      checkAuth();

      return () => {
        isMounted = false;
      };
    }, [isWalletConnected, providerDetails, isLoadingOnlineStatus, isLoadingProviderDetails, isOnline, router, walletCheckCount]);

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
            color: "var(--text-color, currentColor)"
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
