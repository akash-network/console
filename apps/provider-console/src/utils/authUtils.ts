import type { AuthMode, UserType } from "@src/types/auth";

export const getAuthModeFromStorage = (): AuthMode => {
  if (typeof window === "undefined") return "wallet";
  return (localStorage.getItem("authMode") as AuthMode) || "wallet";
};

export const setAuthModeToStorage = (mode: AuthMode): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("authMode", mode);
};

export const getUserTypeFromAuthMode = (authMode: AuthMode): UserType => {
  return authMode === "akash-at-home" ? "akash-at-home-user" : "provider";
};

export const isAuthModeValid = (mode: string): mode is AuthMode => {
  return mode === "wallet" || mode === "akash-at-home";
};

export const getDefaultAuthMode = (): AuthMode => {
  return "wallet";
};

export const clearAuthData = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("authMode");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("walletAddress");
};
