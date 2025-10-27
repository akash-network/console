"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

import type { Auth0User } from "@src/types/auth0";

interface Auth0ContextType {
  user: Auth0User | null;
  isLoading: boolean;
  error: Error | null;
  login: () => void;
  logout: () => void;
  setUser: (user: Auth0User | null) => void;
}

const Auth0Context = createContext<Auth0ContextType | undefined>(undefined);

export const useAuth0 = () => {
  const context = useContext(Auth0Context);
  if (context === undefined) {
    throw new Error("useAuth0 must be used within an Auth0Provider");
  }
  return context;
};

interface Auth0ProviderProps {
  children: React.ReactNode;
}

export const Auth0Provider: React.FC<Auth0ProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Auth0User | null>(null);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    // Check if user is already authenticated (from localStorage or session)
    const checkAuthStatus = () => {
      // This will be handled by the callback page after Auth0 redirect
      // For now, we'll start with no user
      setUser(null);
    };

    checkAuthStatus();
  }, []);

  const login = () => {
    // Redirect to Auth0 login with specific configuration for this application
    const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback`;

    // Check if Auth0 is properly configured
    if (!auth0Domain || !clientId) {
      console.warn("Auth0 not configured, redirecting to callback for mock authentication");
      // Redirect to callback page which will handle mock authentication
      window.location.href = redirectUri;
      return;
    }

    // Generate a random state parameter for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("auth0_state", state);

    const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
    const auth0Url =
      `https://${auth0Domain}/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=openid profile email&` +
      `state=${state}` +
      (audience ? `&audience=${encodeURIComponent(audience)}` : "");

    console.log("Auth0 Configuration:");
    console.log("- Domain:", auth0Domain);
    console.log("- Client ID:", clientId);
    console.log("- Audience:", audience || "none");
    console.log("- Redirect URI:", redirectUri);
    console.log("- State:", state);
    console.log("Redirecting to Auth0:", auth0Url);
    window.location.href = auth0Url;
  };

  const logout = () => {
    // Redirect to Python backend logout or Auth0 logout
    const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
    const returnTo = window.location.origin;

    const logoutUrl = `https://${auth0Domain}/v2/logout?` + `client_id=${clientId}&` + `returnTo=${encodeURIComponent(returnTo)}`;

    window.location.href = logoutUrl;
  };

  const value: Auth0ContextType = {
    user,
    isLoading,
    error,
    login,
    logout,
    setUser
  };

  return <Auth0Context.Provider value={value}>{children}</Auth0Context.Provider>;
};
