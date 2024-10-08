import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useWallet } from "@src/context/WalletProvider";
import { Spinner } from "@akashnetwork/ui/components";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import authClient from "@src/utils/authClient";

const withAuth = (WrappedComponent: React.ComponentType) => {
  const AuthComponent: React.FC = props => {
    const { isWalletConnected, address } = useWallet();
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const checkAuth = async () => {
        if (!isWalletConnected || !address) {
          router.push("/");
          return;
        }

        const accessToken = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");

        if (!accessToken) {
          router.push("/");
          return;
        }

        try {
          console.log("accessToken", accessToken);
          const { exp } = jwtDecode<{ exp: number }>(accessToken);

          console.log("expired", exp);
          if (Date.now() >= exp * 1000) {
            if (refreshToken) {
              const response = await authClient.post("/auth/refresh", { address, refresh_token: refreshToken });
              localStorage.setItem("accessToken", response.data.access_token);
              localStorage.setItem("refreshToken", response.data.refresh_token);
            } else {
              router.push("/");
              return;
            }
          }
        } catch (error) {
          console.error("Token validation error:", error);
          router.push("/");
          return;
        }

        setLoading(false);
      };

      const timer = setTimeout(checkAuth, 1500); // Wait for 3 seconds before redirecting

      return () => clearTimeout(timer); // Cleanup the timer on component unmount
    }, [isWalletConnected, address, router]);

    if (loading) {
      return (
        // TODO: Fix styling here to more sophisticated loading screen
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            fontSize: "24px",
            color: "#333"
          }}
        >
          <Spinner />
        </div>
      ); // Show styled loading indicator
    }

    return <WrappedComponent {...props} />;
  };

  return AuthComponent;
};

export default withAuth;
