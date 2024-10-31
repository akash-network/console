import React, { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";

export const withAuth = (WrappedComponent: React.ComponentType) => {
  const AuthComponent: React.FC = props => {
    const { isWalletConnected, address, isProvider, isProviderStatusFetched } = useWallet();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Checking wallet connection...");

    useEffect(() => {
      if (!isWalletConnected) {
        setLoadingMessage("Connecting to wallet...");
        router.push("/");
      } else if (!address) {
        setLoadingMessage("Retrieving wallet address...");
        router.push("/");
      } else if (!isProviderStatusFetched) {
        setLoadingMessage("Checking provider status...");
        return;
      } else {
        setLoading(false);
      }
    }, [isWalletConnected, address, router, isProviderStatusFetched, isProvider]);

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
