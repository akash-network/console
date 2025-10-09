"use client";
import React, { createContext, useContext, useState } from "react";

import type { AkashAtHomeState, UserToken } from "@src/types/akashAtHome";
import { akashAtHomeClient } from "@src/utils/akashAtHomeClient";

interface AkashAtHomeContextType extends AkashAtHomeState {
  generateToken: () => Promise<UserToken>;
  downloadISO: () => Promise<Blob>;
  refreshDeviceInfo: () => Promise<void>;
  refreshEarnings: () => Promise<void>;
  getInstallationLogs: () => Promise<string[]>;
  clearError: () => void;
}

const AkashAtHomeContext = createContext<AkashAtHomeContextType | undefined>(undefined);

export const useAkashAtHome = () => {
  const context = useContext(AkashAtHomeContext);
  if (context === undefined) {
    throw new Error("useAkashAtHome must be used within an AkashAtHomeProvider");
  }
  return context;
};

interface AkashAtHomeProviderProps {
  children: React.ReactNode;
}

export const AkashAtHomeProvider: React.FC<AkashAtHomeProviderProps> = ({ children }) => {
  const [state, setState] = useState<AkashAtHomeState>({
    user: {
      profile: null,
      token: null
    },
    device: {
      info: null,
      status: null
    },
    earnings: null,
    isLoading: false,
    error: null
  });

  const setLoading = (isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  };

  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error }));
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  const generateToken = async (): Promise<UserToken> => {
    setLoading(true);
    setError(null);

    try {
      const token = await akashAtHomeClient.generateToken();
      setState(prev => ({
        ...prev,
        user: { ...prev.user, token }
      }));
      return token;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate token";
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const downloadISO = async (): Promise<Blob> => {
    setLoading(true);
    setError(null);

    try {
      return await akashAtHomeClient.downloadISO();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to download ISO";
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshDeviceInfo = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const [deviceInfo, installationStatus] = await Promise.all([akashAtHomeClient.getDeviceInfo(), akashAtHomeClient.getInstallationStatus()]);

      setState(prev => ({
        ...prev,
        device: {
          info: deviceInfo,
          status: installationStatus
        }
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch device info";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshEarnings = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const earnings = await akashAtHomeClient.getEarnings();
      setState(prev => ({ ...prev, earnings }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch earnings";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getInstallationLogs = async (): Promise<string[]> => {
    setLoading(true);
    setError(null);

    try {
      return await akashAtHomeClient.getInstallationLogs();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch installation logs";
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: AkashAtHomeContextType = {
    ...state,
    generateToken,
    downloadISO,
    refreshDeviceInfo,
    refreshEarnings,
    getInstallationLogs,
    clearError
  };

  return <AkashAtHomeContext.Provider value={value}>{children}</AkashAtHomeContext.Provider>;
};
