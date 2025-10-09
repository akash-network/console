"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";

import { useAuth0 } from "@src/context/Auth0Provider";
import { useProvider } from "@src/context/ProviderContext";
import { useWallet } from "@src/context/WalletProvider";
import type { AuthContextType, AuthMode, AuthProviderProps, AuthState } from "@src/types/auth";
import { clearAuthData, getAuthModeFromStorage, getUserTypeFromAuthMode, setAuthModeToStorage } from "@src/utils/authUtils";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const router = useRouter();
  const { user: auth0User, isLoading: auth0Loading, login: auth0Login, logout: auth0Logout } = useAuth0();
  const { isWalletConnected } = useWallet();
  const { providerDetails, isLoadingProviderDetails } = useProvider();

  const [authState, setAuthState] = useState<AuthState>({
    authMode: "wallet",
    userType: "provider",
    isAuthenticated: false,
    canSwitchModes: false,
    isLoading: true
  });

  // Initialize auth mode from storage
  useEffect(() => {
    const storedAuthMode = getAuthModeFromStorage();
    setAuthState(prev => ({
      ...prev,
      authMode: storedAuthMode,
      userType: getUserTypeFromAuthMode(storedAuthMode)
    }));
  }, []);

  // Handle authentication state changes
  useEffect(() => {
    const updateAuthState = () => {
      if (authState.authMode === "akash-at-home") {
        // Akash at Home authentication
        const isAuthenticated = !!auth0User;
        setAuthState(prev => ({
          ...prev,
          isAuthenticated,
          isLoading: auth0Loading
        }));

        // Don't redirect automatically for Akash at Home - let the callback handle it
        console.log("Akash at Home auth state:", { isAuthenticated, auth0User: !!auth0User, auth0Loading });
      } else {
        // Provider authentication (existing wallet-based)
        const isAuthenticated = isWalletConnected && !!providerDetails;
        setAuthState(prev => ({
          ...prev,
          isAuthenticated,
          isLoading: auth0Loading || isLoadingProviderDetails
        }));

        // Redirect to provider dashboard when wallet is connected
        if (isWalletConnected && authState.authMode === "wallet") {
          console.log("Wallet connected, redirecting to provider dashboard...");
          router.push("/provider-dashboard");
        }
      }
    };

    updateAuthState();
  }, [authState.authMode, auth0User, auth0Loading, isWalletConnected, providerDetails, isLoadingProviderDetails, router]);

  const switchAuthMode = (mode: AuthMode) => {
    setAuthModeToStorage(mode);
    setAuthState(prev => ({
      ...prev,
      authMode: mode,
      userType: getUserTypeFromAuthMode(mode),
      isAuthenticated: false
    }));

    // Clear existing auth data when switching modes
    clearAuthData();

    // Redirect to appropriate page
    if (mode === "akash-at-home") {
      // Redirect directly to Auth0 login
      auth0Login();
    } else {
      // For provider mode, trigger wallet connection automatically
      // The wallet connection will be handled by the existing wallet flow
      // After successful connection, user will be redirected to dashboard
    }
  };

  const login = async (mode: AuthMode) => {
    if (mode === "akash-at-home") {
      auth0Login();
    } else {
      // Existing wallet login flow
      router.push("/connect-wallet");
    }
  };

  const logout = async () => {
    if (authState.authMode === "akash-at-home") {
      auth0Logout();
    } else {
      // Existing wallet logout flow
      clearAuthData();
      router.push("/");
    }
  };

  const value: AuthContextType = {
    ...authState,
    switchAuthMode,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
