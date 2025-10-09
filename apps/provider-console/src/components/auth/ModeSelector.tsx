"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { Button } from "@akashnetwork/ui/components";
import { ArrowRight, Cloud, Home } from "iconoir-react";
import { useRouter } from "next/router";

import { useAuth } from "@src/context/AuthProvider";
import { useWallet } from "@src/context/WalletProvider";

export const ModeSelector: React.FC = () => {
  const { switchAuthMode } = useAuth();
  const { connectWallet } = useWallet();
  const router = useRouter();

  const handleModeSelection = async (mode: "wallet" | "akash-at-home") => {
    if (mode === "wallet") {
      // For provider mode, switch to wallet mode and trigger wallet connection
      switchAuthMode(mode);
      // Trigger wallet connection after switching mode
      try {
        console.log("Starting wallet connection...");
        await connectWallet();
        console.log("Wallet connection successful, redirecting...");
        // Redirect to provider dashboard after successful wallet connection
        router.push("/provider-dashboard");
      } catch (error) {
        console.error("Wallet connection failed:", error);
      }
    } else {
      // For Akash at Home, directly redirect to setup page (mock authentication)
      router.push("/akash-at-home/setup");
    }
  };

  return (
    <div className="from-background via-background to-muted/20 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-foreground mb-4 text-4xl font-bold">Welcome to Provider Console</h1>
          <p className="text-muted-foreground text-xl">Choose your experience to get started</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Provider Console Option */}
          <Card className="hover:border-primary/20 hover:shadow-primary/5 group cursor-pointer border-2 transition-all duration-300 hover:shadow-lg">
            <CardHeader className="text-center">
              <div className="bg-primary/10 dark:bg-primary/20 group-hover:bg-primary/20 dark:group-hover:bg-primary/30 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors">
                <Cloud className="text-primary h-8 w-8" />
              </div>
              <CardTitle className="text-foreground text-2xl font-bold">Own Provider</CardTitle>
              <p className="text-muted-foreground mt-2">Custom managed providers with your own multi server hardware</p>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="mb-6 space-y-2 text-left">
                <li className="text-muted-foreground flex items-center text-sm">
                  <span className="bg-primary mr-3 h-2 w-2 rounded-full"></span>
                  Full control and maintenance responsibility
                </li>
                <li className="text-muted-foreground flex items-center text-sm">
                  <span className="bg-primary mr-3 h-2 w-2 rounded-full"></span>
                  Higher earning potential with powerful machines
                </li>
                <li className="text-muted-foreground flex items-center text-sm">
                  <span className="bg-primary mr-3 h-2 w-2 rounded-full"></span>
                  Keep 100% of revenue (no sharing)
                </li>
                <li className="text-muted-foreground flex items-center text-sm">
                  <span className="bg-primary mr-3 h-2 w-2 rounded-full"></span>
                  Requires port forwarding and domain setup
                </li>
              </ul>
              <Button
                onClick={() => handleModeSelection("wallet")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground group-hover:bg-primary/90 w-full shadow-lg transition-all duration-300 hover:shadow-xl"
              >
                Continue as Provider
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Akash at Home Option */}
          <Card className="group cursor-pointer border-2 transition-all duration-300 hover:border-green-500/20 hover:shadow-lg hover:shadow-green-500/5">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 transition-colors group-hover:bg-green-500/20 dark:bg-green-500/20 dark:group-hover:bg-green-500/30">
                <Home className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-foreground text-2xl font-bold">Akash HomeNode</CardTitle>
              <p className="text-muted-foreground mt-2">1-click ISO install solution for easy participation in the Akash network</p>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="mb-6 space-y-2 text-left">
                <li className="text-muted-foreground flex items-center text-sm">
                  <span className="mr-3 h-2 w-2 rounded-full bg-green-500"></span>
                  No port forwarding required
                </li>
                <li className="text-muted-foreground flex items-center text-sm">
                  <span className="mr-3 h-2 w-2 rounded-full bg-green-500"></span>
                  Participate in existing provider network
                </li>
                <li className="text-muted-foreground flex items-center text-sm">
                  <span className="mr-3 h-2 w-2 rounded-full bg-green-500"></span>
                  Easy setup with minimal technical knowledge
                </li>
                <li className="text-muted-foreground flex items-center text-sm">
                  <span className="mr-3 h-2 w-2 rounded-full bg-green-500"></span>
                  Shared revenue model
                </li>
              </ul>
              <Button
                onClick={() => handleModeSelection("akash-at-home")}
                className="w-full bg-green-600 text-white shadow-lg transition-all duration-300 hover:bg-green-700 hover:shadow-xl group-hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 dark:group-hover:bg-green-700"
              >
                Start with Akash at Home
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">You can switch between experiences at any time</p>
        </div>
      </div>
    </div>
  );
};
