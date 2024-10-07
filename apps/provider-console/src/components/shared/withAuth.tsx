import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useWallet } from "@src/context/WalletProvider";
import { Spinner } from "@akashnetwork/ui/components";
import axios from "axios";
import jwtDecode from "jwt-decode";

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

        // try {
        //   const { exp } = jwtDecode<{ exp: number }>(accessToken);
        //   if (Date.now() >= exp * 1000) {
        //     if (refreshToken) {
        //       const response = await axios.post("/auth/refresh", { token: refreshToken });
        //       localStorage.setItem("accessToken", response.data.accessToken);
        //     } else {
        //       router.push("/");
        //       return;
        //     }
        //   }
        // } catch (error) {
        //   console.error("Token validation error:", error);
        //   router.push("/");
        //   return;
        // }

        setLoading(false);
      };

      const timer = setTimeout(checkAuth, 3000); // Wait for 3 seconds before redirecting

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
