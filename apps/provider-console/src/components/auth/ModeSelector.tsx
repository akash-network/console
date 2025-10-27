"use client";
import React from "react";
import { Button } from "@akashnetwork/ui/components";
import { ArrowRight, Cloud, Dollar, Flash, Rocket } from "iconoir-react";
import Image from "next/image";
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
      // For Akash HomeNode, use the proper authentication flow with Auth0
      switchAuthMode(mode);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Half - Own Provider (50%) */}
      <div className="flex w-1/2 flex-col items-center justify-center bg-black p-12">
        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="mb-8">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500">
              <Cloud className="h-8 w-8 text-white" />
            </div>
            <h2 className="mb-4 text-3xl font-bold text-white">Own Provider</h2>
            <p className="text-white">Custom managed providers with your own multi server hardware</p>
          </div>

          {/* Features */}
          <div className="mb-8 space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
                <Cloud className="h-6 w-6 text-black" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Full Control</h3>
                <p className="text-sm text-gray-300">Complete control and maintenance responsibility for your infrastructure.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
                <Dollar className="h-6 w-6 text-black" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Higher Earnings</h3>
                <p className="text-sm text-gray-300">Higher earning potential with powerful machines and dedicated resources.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
                <Rocket className="h-6 w-6 text-black" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">100% Revenue</h3>
                <p className="text-sm text-gray-300">Keep 100% of revenue with no sharing or commission fees.</p>
              </div>
            </div>
          </div>

          {/* Wallet Connection Button */}
          <div className="text-left">
            <Button onClick={() => handleModeSelection("wallet")} className="w-full bg-red-600 text-white hover:bg-red-700" size="lg">
              Continue as Provider
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Bottom Text */}
          {/* <div className="mt-8 text-left">
            <p className="text-sm text-white">
              You can switch between experiences at any time
            </p>
          </div> */}
        </div>
      </div>

      {/* Right Half - Akash HomeNode with Background (50%) */}
      <div className="relative flex w-1/2 items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image src="/images/akash-home-node-background.png" alt="Akash HomeNode Background" fill className="object-cover" priority style={{ opacity: 0.2 }} />
        </div>

        {/* Content Overlay - Centered */}
        <div className="relative z-10 w-full max-w-xl p-12">
          {/* Logo */}
          <div className="mb-8">
            <Image src="/images/akash-home-node.svg" alt="Akash HomeNode" width={405} height={60} className="w-auto" />
          </div>

          {/* Main Message */}
          <div className="mb-12">
            <h2 className="mb-6 text-left text-2xl font-semibold text-white">
              Start earning money with your unused compute power by joining our Akash Network
            </h2>
          </div>

          {/* Features */}
          <div className="mb-8 space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
                <Flash className="h-6 w-6 text-black" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Easy setup</h3>
                <p className="text-sm text-gray-300">A simple 2 step process and we&apos;ll set up your device automatically.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
                <Dollar className="h-6 w-6 text-black" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Earn money</h3>
                <p className="text-sm text-gray-300">Join our network and get paid for your compute resources.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
                <Rocket className="h-6 w-6 text-black" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">3rd value prop</h3>
                <p className="text-sm text-gray-300">Short description goes here.</p>
              </div>
            </div>
          </div>

          {/* Login Button */}
          <div className="text-left">
            <Button onClick={() => handleModeSelection("akash-at-home")} className="w-full bg-white text-black hover:bg-gray-100" size="lg">
              Start with Akash HomeNode
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
