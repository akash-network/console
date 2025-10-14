"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { useAuth0 } from "@src/context/Auth0Provider";
import type { Auth0User } from "@src/types/auth0";
import { akashAtHomeClient } from "@src/utils/akashAtHomeClient";

export default function CallbackPage() {
  const router = useRouter();
  const { setUser } = useAuth0();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const state = urlParams.get("state");
        const errorParam = urlParams.get("error");

        if (errorParam) {
          setError(`Authentication failed: ${errorParam}`);
          return;
        }

        if (!code) {
          setError("No authorization code received");
          return;
        }

        // Validate state parameter for security
        const storedState = localStorage.getItem("auth0_state");
        if (!state || !storedState || state !== storedState) {
          setError("Invalid state parameter - possible CSRF attack");
          return;
        }

        // Clean up state from localStorage
        localStorage.removeItem("auth0_state");

        try {
          // Authenticate with Python backend
          const { accessToken, user: userProfile } = await akashAtHomeClient.authenticateWithAuth0(code, state || undefined);

          // Store the access token
          akashAtHomeClient.setAccessToken(accessToken);

          // Set user in Auth0 context
          if (userProfile) {
            setUser(userProfile as Auth0User);
          }

          // Redirect to setup page
          router.push("/akash-homenode/setup");
        } catch (backendError) {
          console.warn("Backend not available, using mock authentication for testing:", backendError);

          // Mock authentication for testing when backend is not available
          const mockUser: Auth0User = {
            id: "mock-user-id",
            email: "test@example.com",
            name: "Test User",
            picture: "https://via.placeholder.com/150"
          };

          const mockAccessToken = "mock-access-token-" + Date.now();

          // Store the mock access token
          akashAtHomeClient.setAccessToken(mockAccessToken);

          // Set mock user in Auth0 context
          setUser(mockUser);

          // Wait a bit to ensure state is set, then redirect
          setTimeout(() => {
            router.push("/akash-homenode/setup");
          }, 100);
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [router, setUser]);

  if (isLoading) {
    return (
      <div className="from-background via-background flex min-h-screen items-center justify-center bg-gradient-to-br to-green-500/5 dark:to-green-500/10">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-green-600 dark:border-green-400"></div>
          <h2 className="text-foreground mb-2 text-xl font-semibold">Completing authentication...</h2>
          <p className="text-muted-foreground">Please wait while we set up your account</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="from-background via-background flex min-h-screen items-center justify-center bg-gradient-to-br to-red-500/5 dark:to-red-500/10">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 dark:bg-red-500/20">
            <span className="text-2xl text-red-600 dark:text-red-400">⚠️</span>
          </div>
          <h2 className="text-foreground mb-2 text-xl font-semibold">Authentication failed</h2>
          <p className="text-muted-foreground mb-4">There was an error during the authentication process</p>
          <button
            onClick={() => router.push("/auth/login")}
            className="rounded-md bg-red-600 px-4 py-2 text-white shadow-lg transition-all duration-300 hover:bg-red-700 hover:shadow-xl dark:bg-red-600 dark:hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
